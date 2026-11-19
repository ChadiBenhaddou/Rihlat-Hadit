# 0005 — Every D1 query goes through a session

**Status:** Accepted · 2026-11-19

## Context
D1 read replication is opt-in and works only through the Sessions API (`env.DB.withSession()`).

## Decision
`apps/web/server/db.ts` exposes `coreDb(env, bookmark?)` and `searchDb(env, bookmark?)`, both returning a `D1DatabaseSession` (default `first-unconstrained`). Server code takes a `Db` (session) parameter, never `env.DB` directly.

## Consequences
- Turning on replicas later is a dashboard switch plus, for writes followed by reads, passing the bookmark back to the client.
- Sessions add nothing measurable while replication is off.
