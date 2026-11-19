# رحلة الحديث في صحيح البخاري

A research platform that turns each isnad of Sahih al-Bukhari into an animated, explorable, fully sourced graph. The specification is [`SPEC.md`](SPEC.md), and it overrides everything here.

**Status:** Phases 0–3 done and Phase 4 mostly done, all locally (see SPEC §18). Sahih al-Bukhari is loaded from the approved sources in `docs/data-sources.md`.

## Layout

| Path | What |
| --- | --- |
| `apps/web` | The one Worker: React Router SSR, Hono API at `/api/v1`, static assets, D1 migrations |
| `packages/shared` | zod payload contracts and the TypeScript Arabic normalizer |
| `packages/graph` | Pure graph logic (route merging, indicators), testable without the runtime |
| `pipeline` | Offline Python data pipeline (uv). Never runs on Workers |
| `fixtures` | Labelled test fixtures, including `normalization-cases.json` |
| `docs/adr` | Architecture decision records |
| `scripts` | Repository tooling |

## Requirements

Node 22.22+ (24 in CI), pnpm 12 (`packageManager` pins it), Python 3.12+ with [uv](https://docs.astral.sh/uv/).

## Running it locally

```sh
pnpm install
cp apps/web/.dev.vars.example apps/web/.dev.vars    # Turnstile test keys and a dev-only admin login
cd pipeline && uv sync && uv run python build.py && cd ..   # needs the raw sources in data/raw (see docs/data-sources.md)
scripts/load-local.sh                                # loads the build into local D1 (local only)
pnpm --filter @isnad/web dev                         # http://localhost:5173, English at /en
```

Editorial tools are at `/admin`. Locally, `DEV_ADMIN_EMAIL` from `.dev.vars` signs you in. Add that email to the `staff` table once:

```sh
cd apps/web && pnpm exec wrangler d1 execute DB --local --command "INSERT OR REPLACE INTO staff VALUES ('admin@localhost', 'admin')"
```

In production, `/admin` sits behind Cloudflare Access, and the Worker verifies the Access JWT itself. The dev login is compiled out of production builds.

## Common tasks

```sh
pnpm install
pnpm --filter @isnad/web db:migrate:local   # apply both D1 schemas to the local database
pnpm --filter @isnad/web dev                # http://localhost:5173
pnpm typecheck && pnpm lint && pnpm test    # TypeScript checks

cd pipeline
uv sync
uv run ruff check . && uv run mypy && uv run pytest
```

After any binding change in `apps/web/wrangler.jsonc`, run `pnpm --filter @isnad/web cf-typegen` and commit `worker-configuration.d.ts`.

## Cloudflare resources

The IDs in `wrangler.jsonc` are placeholders. The account owner creates the resources once per environment:

```sh
cd apps/web
pnpm exec wrangler d1 create isnad-core-preview
pnpm exec wrangler d1 create isnad-search-preview
pnpm exec wrangler kv namespace create CONFIG --env preview
pnpm exec wrangler r2 bucket create isnad-data-preview
# same again without -preview for production
```

Then paste the IDs into `wrangler.jsonc` and run `pnpm db:migrate:preview`. Secrets (`TURNSTILE_SECRET`, `ACCESS_AUD`) are set with `wrangler secret put` only.

## Principles

Read SPEC §3 before contributing. In short: research first, no automatic verdicts, a source on every fact, never invent data, no depictions of people, Arabic first, licensed data only.
