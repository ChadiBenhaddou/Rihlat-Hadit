# 0008 — Bindings are added in the phase that uses them

**Status:** Accepted · 2026-11-19

## Context
SPEC §17 lists all bindings; Phase 0 requires only `DB`, `SEARCH_DB`, `CONFIG` and `DATA`. Vectorize and Workers AI have no local simulator, and declaring them forces remote access for `wrangler dev` and tests.

## Decision
`wrangler.jsonc` declares the four Phase 0 bindings, top-level and under `env.preview`. `SEARCH_LIMITER`/`REPORT_LIMITER`/`API_LIMITER` arrive with the search and report endpoints (Phase 1–2); `MATN_INDEX` and `AI` with semantic search (Phase 4). Resource IDs are placeholders until the account owner runs `wrangler d1 create` / `kv namespace create` / `r2 bucket create`.

## Consequences
- Local dev and tests stay fully offline.
- Each later phase must add its bindings to both the top level and `env.preview`, then rerun `wrangler types` and commit the result.
