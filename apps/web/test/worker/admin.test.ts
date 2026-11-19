/** Editorial tools (SPEC §14) against a TEST FIXTURE: Access JWT checks and the propose → decide → apply flow. */
import { env } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { NarratorProfile } from '@isnad/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { verifyAccessJwt, type Staff } from '../../server/admin/access';
import { decide, propose, validateProposal } from '../../server/admin/proposals';
import { seed } from './seed';

const TEAM = 'fixture-team.cloudflareaccess.com';
const AUD = 'fixture-aud';
const b64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));

let keys: CryptoKeyPair;
let certs: Response;
async function sign(payload: Record<string, unknown>, key = keys.privateKey): Promise<string> {
  const head = enc({ alg: 'RS256', kid: 'k1', typ: 'JWT' });
  const body = enc(payload);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}
const fetcher = (async () => certs.clone()) as unknown as typeof fetch;
const now = Date.UTC(2026, 10, 19);
const good = { aud: [AUD], iss: `https://${TEAM}`, exp: now / 1000 + 600, email: 'Reviewer@Example.org' };

beforeAll(async () => {
  keys = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey('jwk', keys.publicKey)) as JsonWebKey;
  certs = Response.json({ keys: [{ kid: 'k1', kty: 'RSA', n: jwk.n, e: jwk.e }] });
  await seed();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO staff VALUES ('editor@example.org', 'editor'), ('reviewer@example.org', 'reviewer'), ('admin@example.org', 'admin')",
    ),
  ]);
});

describe('Access JWT', () => {
  const opts = () => ({ teamDomain: TEAM, aud: AUD, now, fetcher });
  it('accepts a valid token and returns the lower-cased email', async () => {
    expect(await verifyAccessJwt(await sign(good), opts())).toBe('reviewer@example.org');
  });
  it('rejects wrong audience, wrong issuer, expiry and a forged signature', async () => {
    expect(await verifyAccessJwt(await sign({ ...good, aud: ['other'] }), opts())).toBeNull();
    expect(await verifyAccessJwt(await sign({ ...good, iss: 'https://evil.example' }), opts())).toBeNull();
    expect(await verifyAccessJwt(await sign({ ...good, exp: now / 1000 - 1 }), opts())).toBeNull();
    const other = (await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      false,
      ['sign'],
    )) as CryptoKeyPair;
    expect(await verifyAccessJwt(await sign(good, other.privateKey), opts())).toBeNull();
    expect(await verifyAccessJwt('not.a.jwt', opts())).toBeNull();
  });
  it('keeps /admin closed without a verified identity', async () => {
    const res = await exports.default.fetch(new Request('https://example.test/api/v1/admin/queue'));
    expect(res.status).toBe(401);
  });
});

describe('propose → decide → apply', () => {
  const editor: Staff = { email: 'editor@example.org', role: 'editor' };
  const reviewer: Staff = { email: 'reviewer@example.org', role: 'reviewer' };
  const db = () => env.DB.withSession('first-primary');

  it('only allows whitelisted fields with valid values', () => {
    expect(
      validateProposal({ kind: 'set_field', payload: { entity: 'narrator', id: 14, field: 'slug', value: 'x' } }).ok,
    ).toBe(false);
    expect(
      validateProposal({ kind: 'set_field', payload: { entity: 'narrator', id: 14, field: 'tabaqa', value: 'one' } })
        .ok,
    ).toBe(false);
    expect(validateProposal({ kind: 'merge_narrators', payload: { from: 'r1', into: 'r1' } }).ok).toBe(false);
  });

  it('applies an approved honorific with a revision, and forbids self-approval', async () => {
    const v = validateProposal({
      kind: 'set_field',
      payload: { entity: 'narrator', id: 14, field: 'honorific_ar', value: 'رضي الله عنه' },
    });
    if (!v.ok) throw new Error(v.error);
    const id = await propose(db(), editor, v.value, 'مصدر الصحبة: كتاب-اختبار', null);
    expect((await decide(db(), editor, id, true)).ok).toBe(false);
    expect((await decide(db(), reviewer, id, true)).ok).toBe(true);
    expect(await env.DB.prepare('SELECT honorific_ar FROM narrators WHERE id = 14').first()).toEqual({
      honorific_ar: 'رضي الله عنه',
    });
    const r = await env.DB.prepare(
      "SELECT old_value, new_value, actor_email FROM revisions WHERE field = 'honorific_ar'",
    ).first();
    expect(r).toEqual({ old_value: null, new_value: 'رضي الله عنه', actor_email: 'reviewer@example.org' });
  });

  it('a cited summary grade becomes visible', async () => {
    const v = validateProposal({
      kind: 'add_citation',
      payload: { narratorId: 11, target: 'summary_grade', sourceSlug: 'fixture-ds', locator: 'ص 1' },
    });
    if (!v.ok) throw new Error(v.error);
    await decide(db(), reviewer, await propose(db(), editor, v.value, 'إسناد الوصف إلى مصدره', null), true);
    const p = NarratorProfile.parse(
      await (await exports.default.fetch(new Request('https://example.test/api/v1/narrators/r11'))).json(),
    );
    expect(p.summaryGrade?.textAr).toBe('وصف غير منسوب');
  });

  it('merges narrators, keeps the old slug as a redirect and rebuilds transmissions', async () => {
    const v = validateProposal({ kind: 'merge_narrators', payload: { from: 'r15', into: 'r12' } });
    if (!v.ok) throw new Error(v.error);
    await decide(db(), reviewer, await propose(db(), editor, v.value, 'هما شخص واحد', null), true);
    expect(await env.DB.prepare("SELECT narrator_id FROM narrator_redirects WHERE old_slug = 'r15'").first()).toEqual({
      narrator_id: 12,
    });
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM chain_links WHERE narrator_id = 15').first()).toEqual({
      n: 0,
    });
    expect(
      await env.DB.prepare('SELECT hadith_count FROM transmissions WHERE teacher_id = 12 AND student_id = 10').first(),
    ).toEqual({ hadith_count: 1 });
    const res = await exports.default.fetch(new Request('https://example.test/api/v1/narrators/r15', { redirect: 'manual' }));
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('/api/v1/narrators/r12');
  });
});
