import type { MiddlewareHandler } from 'hono';

export type SecurityVariables = { nonce: string };

function makeNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Strict security headers (SPEC §14). Scripts and fonts are self-hosted; the
 * only inline scripts are React Router's hydration scripts, which carry a
 * per-request nonce. Vite dev needs eval and a websocket, so dev relaxes it.
 */
export const securityHeaders: MiddlewareHandler<{ Variables: SecurityVariables }> = async (c, next) => {
  const nonce = makeNonce();
  c.set('nonce', nonce);
  await next();
  const h = c.res.headers;
  const dev = import.meta.env.DEV;
  const csp = [
    "default-src 'self'",
    dev ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'` : `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data:",
    dev ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
  h.set('Content-Security-Policy', csp);
  h.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
};
