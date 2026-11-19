import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { ProblemDetails, VersionResponse } from '@isnad/shared';

const call = (path: string) => exports.default.fetch(new Request(`https://example.test${path}`));

describe('GET /api/v1/version', () => {
  it('reports "unpublished" before any data publish', async () => {
    const res = await call('/api/v1/version');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=60');
    expect(VersionResponse.parse(await res.json())).toEqual({ dataVersion: 'unpublished' });
  });

  it('falls back to the latest data_versions row', async () => {
    await env.DB.prepare(
      "INSERT INTO data_versions (label, published_at) VALUES ('fixture-v1', '2026-01-01T00:00:00Z')",
    ).run();
    const res = await call('/api/v1/version');
    expect(await res.json()).toEqual({ dataVersion: 'fixture-v1' });
  });

  it('prefers CONFIG.data_version', async () => {
    await env.CONFIG.put('data_version', 'fixture-v2');
    const res = await call('/api/v1/version');
    expect(await res.json()).toEqual({ dataVersion: 'fixture-v2' });
  });
});

describe('API errors and headers', () => {
  it('answers unknown API paths with RFC 9457 problem details', async () => {
    const res = await call('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toBe('application/problem+json');
    expect(ProblemDetails.parse(await res.json())).toMatchObject({ status: 404, instance: '/api/v1/does-not-exist' });
  });

  it('sends a strict CSP with a fresh nonce, HSTS and frame-ancestors none', async () => {
    const [a, b] = await Promise.all([call('/api/v1/version'), call('/api/v1/version')]);
    const csp = a.headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]{24}'/);
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? '';
    expect(scriptSrc).not.toContain('unsafe-inline');
    expect(csp).not.toBe(b.headers.get('Content-Security-Policy'));
    expect(a.headers.get('Strict-Transport-Security')).toMatch(/max-age=\d+/);
  });
});
