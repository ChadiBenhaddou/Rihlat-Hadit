# 0009 — Strict CSP with per-request nonces

**Status:** Accepted · 2026-11-19

## Context
SPEC §14 asks for a strict CSP with self-hosted scripts. React Router SSR emits inline hydration scripts, which a plain `script-src 'self'` would block.

## Decision
A Hono middleware creates a 128-bit nonce per request, passes it through the load context to `entry.server.tsx` (`renderToReadableStream({ nonce })`, `<ServerRouter nonce>`) and to `<Scripts>`/`<ScrollRestoration>` in the root layout. The response's CSP allows `'self'` plus that nonce only, with `frame-ancestors 'none'`, `object-src 'none'` and `base-uri 'self'`. HSTS, `nosniff`, a strict referrer policy and a restrictive permissions policy go on every response. Dev mode adds `'unsafe-eval'` and websocket `connect-src` for Vite HMR.

## Consequences
- Nonced HTML cannot be cached and shared as-is. Versioned **API** responses cache freely; for cached SSR pages (Phase 2), switch those routes to hash-based CSP or re-nonce the cached body at the edge.
- `style-src` still allows `'unsafe-inline'` for React's inline style attributes; revisit once the graph renderers land.
