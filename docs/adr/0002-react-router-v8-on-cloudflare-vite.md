# 0002 — React Router v8 on the Cloudflare Vite plugin

**Status:** Accepted · 2026-11-19

## Context
SPEC §5 asks for React Router in framework mode from the Cloudflare scaffold (`npm create cloudflare@latest -- --framework=react-router`), "v8 as of Nov 2026".

On 19 Nov 2026 the scaffold's template (`cloudflare/templates` → `react-router-starter-template`, commit `9674298`) still pins `react-router@7.18.5`, with the `v8_viteEnvironmentApi` future flag. npm's `latest` for `react-router` and `@react-router/dev` is **8.5.2**.

The bandwidth on the build machine was about 65 KB/s, so running C3 (which installs with npm and then again with pnpm) was impractical.

## Decision
Copy the template's files (`entry.server.tsx`, the three `tsconfig` files, `vite.config.ts`, `workers/app.ts` shape, `nodejs_compat`, `observability`, `upload_source_maps`) into `apps/web` and upgrade to React Router 8.5.2. The v7 future flag is dropped because v8 makes it the default. `compatibility_date` is set to a recent date the installed workerd supports instead of the template's 2025-10-08.

## Consequences
- We are ahead of the official template; if it later diverges in a way that matters (e.g. a new Vite plugin option), re-diff against it.
- Re-running C3 later to compare is cheap on a normal connection and is recommended before Phase 2.
