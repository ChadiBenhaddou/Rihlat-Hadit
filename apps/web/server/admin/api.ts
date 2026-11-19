/**
 * /api/v1/admin (SPEC §10, §14). Every request: verified Access identity, then
 * the staff role. Writes go to the primary (session 'first-primary').
 */
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { problem } from '../problem';
import { CAN, currentStaff, type Staff } from './access';
import { decide, propose, publish, validateProposal } from './proposals';
import { listProposals, listQueue, listReports, reviewItem } from './queries';

type AdminEnv = { Bindings: Env; Variables: { staff: Staff; dataVersion: string; versioned: boolean } };
export const admin = new Hono<AdminEnv>();
const primary = (c: Context<AdminEnv>) => c.env.DB.withSession('first-primary');

admin.use('*', async (c, next) => {
  const staff = await currentStaff(c.req.raw, c.env);
  if (!staff) return problem(c, 401, 'Unauthorized', 'sign in through Cloudflare Access as a staff member');
  c.set('staff', staff);
  c.header('Cache-Control', 'no-store');
  await next();
  c.res.headers.set('Cache-Control', 'no-store');
});

const allowed = (c: Context<AdminEnv>, action: keyof typeof CAN) => CAN[action].includes(c.get('staff').role);

admin.get('/me', (c) => c.json(c.get('staff')));

admin.get('/queue', async (c) => {
  const q = z
    .object({
      kind: z.string().max(60).optional(),
      status: z.enum(['open', 'resolved', 'dismissed']).default('open'),
      hadith: z.coerce.number().int().positive().optional(),
      cursor: z.coerce.number().int().min(0).default(0),
    })
    .safeParse(c.req.query());
  if (!q.success) return problem(c, 400, 'Bad Request');
  return c.json(await listQueue(primary(c), q.data));
});

admin.get('/items/:id', async (c) => {
  const id = z.coerce.number().int().positive().safeParse(c.req.param('id'));
  if (!id.success) return problem(c, 400, 'Bad Request');
  const item = await reviewItem(primary(c), id.data);
  return item ? c.json(item) : problem(c, 404, 'Not Found');
});

admin.post('/items/:id/dismiss', async (c) => {
  if (!allowed(c, 'decide')) return problem(c, 403, 'Forbidden');
  const id = z.coerce.number().int().positive().safeParse(c.req.param('id'));
  if (!id.success) return problem(c, 400, 'Bad Request');
  await primary(c).prepare("UPDATE review_items SET status = 'dismissed' WHERE id = ?").bind(id.data).run();
  return c.body(null, 204);
});

admin.get('/proposals', async (c) => {
  const status = z.enum(['pending', 'applied', 'rejected']).default('pending').safeParse(c.req.query('status'));
  if (!status.success) return problem(c, 400, 'Bad Request');
  return c.json(await listProposals(primary(c), status.data));
});

admin.post('/proposals', async (c) => {
  if (!allowed(c, 'propose')) return problem(c, 403, 'Forbidden');
  const body = (await c.req.json().catch(() => null)) as {
    kind?: unknown;
    payload?: unknown;
    reason?: unknown;
    reviewItemId?: unknown;
  } | null;
  const reason = z.string().trim().min(5).max(2000).safeParse(body?.reason);
  if (!reason.success) return problem(c, 400, 'Bad Request', 'a written reason is required');
  const v = validateProposal({ kind: body?.kind, payload: body?.payload });
  if (!v.ok) return problem(c, 400, 'Bad Request', v.error);
  const item = z
    .number()
    .int()
    .positive()
    .nullable()
    .default(null)
    .safeParse(body?.reviewItemId ?? null);
  const id = await propose(primary(c), c.get('staff'), v.value, reason.data, item.success ? item.data : null);
  return c.json({ id }, 201);
});

admin.post('/proposals/:id/decision', async (c) => {
  if (!allowed(c, 'decide')) return problem(c, 403, 'Forbidden', 'reviewers and admins decide proposals');
  const id = z.coerce.number().int().positive().safeParse(c.req.param('id'));
  const body = z.object({ approve: z.boolean() }).safeParse(await c.req.json().catch(() => null));
  if (!id.success || !body.success) return problem(c, 400, 'Bad Request');
  const r = await decide(primary(c), c.get('staff'), id.data, body.data.approve);
  return r.ok ? c.body(null, 204) : problem(c, 409, 'Conflict', r.error);
});

admin.get('/reports', async (c) => c.json(await listReports(primary(c))));

admin.post('/reports/:id', async (c) => {
  if (!allowed(c, 'decide')) return problem(c, 403, 'Forbidden');
  const id = z.coerce.number().int().positive().safeParse(c.req.param('id'));
  const body = z
    .object({ status: z.enum(['open', 'accepted', 'rejected', 'duplicate']) })
    .safeParse(await c.req.json().catch(() => null));
  if (!id.success || !body.success) return problem(c, 400, 'Bad Request');
  await primary(c).prepare('UPDATE reports SET status = ? WHERE id = ?').bind(body.data.status, id.data).run();
  return c.body(null, 204);
});

admin.get('/staff', async (c) => {
  if (!allowed(c, 'manage_staff')) return problem(c, 403, 'Forbidden');
  const { results } = await primary(c).prepare('SELECT email, role FROM staff ORDER BY role, email').all();
  return c.json(results);
});

admin.put('/staff/:email', async (c) => {
  if (!allowed(c, 'manage_staff')) return problem(c, 403, 'Forbidden');
  const email = z.string().email().max(200).safeParse(c.req.param('email'));
  const body = z
    .object({ role: z.enum(['editor', 'reviewer', 'admin']) })
    .safeParse(await c.req.json().catch(() => null));
  if (!email.success || !body.success) return problem(c, 400, 'Bad Request');
  await primary(c)
    .prepare('INSERT OR REPLACE INTO staff (email, role) VALUES (?, ?)')
    .bind(email.data.toLowerCase(), body.data.role)
    .run();
  return c.body(null, 204);
});

admin.delete('/staff/:email', async (c) => {
  if (!allowed(c, 'manage_staff')) return problem(c, 403, 'Forbidden');
  const email = c.req.param('email').toLowerCase();
  if (email === c.get('staff').email) return problem(c, 409, 'Conflict', 'you cannot remove yourself');
  await primary(c).prepare('DELETE FROM staff WHERE email = ?').bind(email).run();
  return c.body(null, 204);
});

admin.post('/publish', async (c) => {
  if (!allowed(c, 'publish')) return problem(c, 403, 'Forbidden', 'admins publish');
  const notes = z.object({ notes: z.string().trim().min(3).max(500) }).safeParse(await c.req.json().catch(() => null));
  if (!notes.success) return problem(c, 400, 'Bad Request', 'publish notes are required');
  return c.json({ dataVersion: await publish(primary(c), c.env, c.get('staff'), notes.data.notes) }, 201);
});
