/** POST /api/v1/reports (SPEC §10, §14), against a TEST FIXTURE. Turnstile is stubbed: no network. */
import { env } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { seed } from './seed';

const realFetch = globalThis.fetch;
function stubTurnstile(success: boolean) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith('https://challenges.cloudflare.com/')) return Response.json({ success });
    return realFetch(input, init);
  });
}

const post = (body: unknown, ip = '203.0.113.1') =>
  exports.default.fetch(
    new Request('https://example.test/api/v1/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip },
      body: JSON.stringify(body),
    }),
  );

const valid = {
  entity: 'hadith',
  entityId: 1,
  message: 'رقم الصفحة في الإحالة خطأ',
  contact: '',
  turnstileToken: 'tok',
};

beforeAll(seed);
afterEach(() => vi.restoreAllMocks());

describe('reports', () => {
  it('stores a verified report and returns 201', async () => {
    stubTurnstile(true);
    const res = await post(valid, '203.0.113.10');
    expect(res.status).toBe(201);
    const row = await env.DB.prepare('SELECT entity, entity_id, message, contact, status FROM reports').first();
    expect(row).toEqual({ entity: 'hadith', entity_id: 1, message: valid.message, contact: null, status: 'open' });
  });

  it('rejects a failed Turnstile check, bad input and unknown entities', async () => {
    stubTurnstile(false);
    expect((await post(valid, '203.0.113.11')).status).toBe(403);
    stubTurnstile(true);
    expect((await post({ ...valid, message: 'قصير' }, '203.0.113.12')).status).toBe(400);
    expect((await post({ ...valid, contact: 'not-an-email' }, '203.0.113.13')).status).toBe(400);
    expect((await post({ ...valid, entityId: 999 }, '203.0.113.14')).status).toBe(404);
  });

  it('allows at most five reports per minute from one address', async () => {
    stubTurnstile(true);
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await post(valid, '198.51.100.7')).status);
    expect(statuses.slice(0, 5).every((s) => s === 201)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
