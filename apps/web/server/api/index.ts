/**
 * /api/v1 (SPEC §10). Every read endpoint also exists under /d/:dataVersion/…;
 * those responses are immutable and cached at the edge by full URL. Unversioned
 * paths answer with max-age=60. Errors are RFC 9457 problem details.
 */
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { VersionResponse } from '@isnad/shared';
import { coreDb, searchDb } from '../db';
import { getBook, listBooks } from '../data/books';
import { getGroupGraph } from '../data/graph';
import { getHadith } from '../data/hadith';
import { getNarrator } from '../data/narrators';
import { searchHadith, searchNarrators } from '../data/search';
import { problem } from '../problem';
import { ReportInput, verifyTurnstile } from '../reports';
import { currentDataVersion } from '../version';

type ApiEnv = { Bindings: Env; Variables: { dataVersion: string; versioned: boolean } };

const reads = new Hono<ApiEnv>();

const Num = z.coerce.number().int().positive().max(99999);
const Slug = z.string().regex(/^[a-z0-9-]{1,64}$/);

reads.get('/version', (c) => c.json(VersionResponse.parse({ dataVersion: c.get('dataVersion') })));

reads.get('/collections/:slug/books', async (c) => {
  const slug = Slug.safeParse(c.req.param('slug'));
  if (!slug.success) return problem(c, 400, 'Bad Request', 'invalid collection');
  const body = await listBooks(coreDb(c.env), slug.data, c.get('dataVersion'));
  return body ? c.json(body) : problem(c, 404, 'Not Found', 'no such collection');
});

reads.get('/collections/:slug/books/:number', async (c) => {
  const slug = Slug.safeParse(c.req.param('slug'));
  const n = Num.safeParse(c.req.param('number'));
  if (!slug.success || !n.success) return problem(c, 400, 'Bad Request');
  const body = await getBook(coreDb(c.env), slug.data, n.data, c.get('dataVersion'));
  return body ? c.json(body) : problem(c, 404, 'Not Found', 'no such book');
});

reads.get('/hadith/:collection/:number', async (c) => {
  const col = Slug.safeParse(c.req.param('collection'));
  const n = Num.safeParse(c.req.param('number'));
  if (!col.success || !n.success) return problem(c, 400, 'Bad Request');
  const body = await getHadith(coreDb(c.env), col.data, n.data, c.get('dataVersion'));
  return body ? c.json(body) : problem(c, 404, 'Not Found', 'no such entry in the loaded data');
});

reads.get('/hadith/:collection/:number/graph', async (c) => {
  const col = Slug.safeParse(c.req.param('collection'));
  const n = Num.safeParse(c.req.param('number'));
  if (!col.success || !n.success) return problem(c, 400, 'Bad Request');
  const body = await getHadith(coreDb(c.env), col.data, n.data, c.get('dataVersion'));
  return body ? c.json(body.graph) : problem(c, 404, 'Not Found', 'no such entry in the loaded data');
});

reads.get('/groups/:id/graph', async (c) => {
  const id = Num.safeParse(c.req.param('id'));
  if (!id.success) return problem(c, 400, 'Bad Request');
  const body = await getGroupGraph(coreDb(c.env), id.data, c.get('dataVersion'));
  return body ? c.json({ ...body.graph, sources: body.sources }) : problem(c, 404, 'Not Found', 'no such group');
});

reads.get('/narrators/:slug', async (c) => {
  const slug = Slug.safeParse(c.req.param('slug'));
  if (!slug.success) return problem(c, 400, 'Bad Request');
  const body = await getNarrator(coreDb(c.env), slug.data, c.get('dataVersion'));
  return body ? c.json(body) : problem(c, 404, 'Not Found', 'no such narrator');
});

const SearchQuery = z.object({
  q: z.string().trim().min(1).max(200),
  type: z.enum(['hadith', 'narrator']).default('hadith'),
  mode: z.enum(['text']).default('text'), // semantic and hybrid arrive in Phase 4
  cursor: z.coerce.number().int().min(0).max(10_000).default(0),
});

reads.get('/search', async (c) => {
  const parsed = SearchQuery.safeParse(c.req.query());
  if (!parsed.success) return problem(c, 400, 'Bad Request', 'q is required (1–200 characters)');
  const { q, type, cursor } = parsed.data;
  const run = type === 'narrator' ? searchNarrators : searchHadith;
  return c.json(await run(coreDb(c.env), searchDb(c.env), q, cursor, c.get('dataVersion')));
});

export const api = new Hono<ApiEnv>();

const clientIp = (c: Context) => c.req.header('cf-connecting-ip') ?? 'local';

// Per-IP limits (SPEC §14): reports 5/min, search 60/min, everything else 300/min.
api.use('*', async (c, next) => {
  const path = c.req.path;
  const limiter = path.endsWith('/reports')
    ? c.env.REPORT_LIMITER
    : path.endsWith('/search')
      ? c.env.SEARCH_LIMITER
      : c.env.API_LIMITER;
  const { success } = await limiter.limit({ key: clientIp(c) });
  if (!success) return problem(c, 429, 'Too Many Requests', 'rate limit exceeded; try again in a minute');
  await next();
});

api.post('/reports', async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = ReportInput.safeParse(raw);
  if (!parsed.success) return problem(c, 400, 'Bad Request', 'invalid report');
  const r = parsed.data;
  if (!(await verifyTurnstile(c.env.TURNSTILE_SECRET, r.turnstileToken, c.req.header('cf-connecting-ip') ?? null))) {
    return problem(c, 403, 'Forbidden', 'Turnstile verification failed');
  }
  const table = r.entity === 'hadith' ? 'hadiths' : 'narrators';
  const exists = await coreDb(c.env, 'first-primary')
    .prepare(`SELECT 1 FROM ${table} WHERE id = ?`)
    .bind(r.entityId)
    .first();
  if (!exists) return problem(c, 404, 'Not Found', `no such ${r.entity}`);
  const row = await coreDb(c.env, 'first-primary')
    .prepare('INSERT INTO reports (entity, entity_id, message, contact) VALUES (?, ?, ?, ?) RETURNING id')
    .bind(r.entity, r.entityId, r.message, r.contact ?? null)
    .first<{ id: number }>();
  // Log the event only: never the message or the contact address.
  console.log(JSON.stringify({ level: 'info', msg: 'report_created', entity: r.entity, id: row?.id }));
  return c.json({ id: row?.id }, 201);
});

// Unversioned: resolve the current version, short cache.
api.use('*', async (c, next) => {
  if (c.req.path.includes('/d/')) return next();
  c.set('dataVersion', await currentDataVersion(c.env, coreDb(c.env)));
  c.set('versioned', false);
  await next();
  if (c.res.status === 200) c.res.headers.set('Cache-Control', 'public, max-age=60');
});

// Versioned: immutable, cached at the edge by full URL.
api.use('/d/:dataVersion/*', async (c, next) => {
  const requested = c.req.param('dataVersion');
  const current = await currentDataVersion(c.env, coreDb(c.env));
  if (requested !== current) return problem(c, 404, 'Not Found', `data version ${requested} is not served`);
  c.set('dataVersion', current);
  c.set('versioned', true);
  const cache = typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : undefined;
  const key = new Request(c.req.url, { method: 'GET' });
  const hit = c.req.method === 'GET' ? await cache?.match(key) : undefined;
  if (hit) return new Response(hit.body, hit);
  await next();
  if (c.res.status === 200) {
    c.res.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    if (cache) c.executionCtx.waitUntil(cache.put(key, c.res.clone()));
  }
});

api.route('/', reads);
api.route('/d/:dataVersion', reads);

// Hono does not carry a sub-app's notFound through app.route(), so the API ends
// with its own catch-all; otherwise unknown /api/v1 paths would reach React Router.
api.all('*', (c: Context) => problem(c, 404, 'Not Found'));
api.onError((err, c) => {
  console.error(
    JSON.stringify({ level: 'error', msg: 'api_error', path: new URL(c.req.url).pathname, error: String(err) }),
  );
  return problem(c, 500, 'Internal Server Error');
});
