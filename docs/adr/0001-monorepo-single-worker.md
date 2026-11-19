# 0001 — pnpm monorepo, one deployable Worker

**Status:** Accepted · 2026-11-19

## Context
SPEC §5–6 put pages, API and static assets in one Worker, and want pure logic testable without the Workers runtime.

## Decision
One pnpm workspace: `apps/web` (the only deployable), `packages/shared` (zod contracts, Arabic normalizer) and `packages/graph` (route merging, indicators). `pipeline/` is a separate uv-managed Python project, outside the pnpm workspace. Packages are consumed as TypeScript source (`exports` → `src/index.ts`); Vite and Vitest compile them, so there is no build step per package.

## Consequences
- One deploy, one set of bindings, no cross-service HTTP.
- Source-only packages keep iteration fast but mean every consumer must use a TS-aware bundler. If a package is ever published, add a build.
- Python and TypeScript stay in lockstep only through shared fixtures (see 0006).
