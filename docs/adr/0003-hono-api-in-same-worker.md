# 0003 — Hono API mounted inside the same Worker

**Status:** Accepted · 2026-11-19

## Context
SPEC §5 replaces FastAPI with Hono at `/api/v1`, in the same Worker as SSR.

## Decision
`workers/app.ts` builds a Hono app: a security-headers middleware on every request, `app.route('/api/v1', api)`, and a catch-all that hands the raw request to React Router's handler with `{ cloudflare: { env, ctx }, nonce }`. Route loaders import the data-access layer in `apps/web/server/` directly; they never fetch `/api/v1`.

## Consequences
- One request never turns into two; loader and API share query code and caching.
- Hono's `notFound`/`onError` on the API sub-app emit RFC 9457 problem details; page errors go through React Router's `ErrorBoundary`.
- The API's OpenAPI document (`/api/v1/openapi.json`) is deferred to Phase 1, when the first data endpoints exist.
