# Architecture decision records

One short record per decision with real trade-offs (SPEC §19.5). Records are
append-only: supersede a record with a new one rather than rewriting it.

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-monorepo-single-worker.md) | pnpm monorepo, one deployable Worker | Accepted |
| [0002](0002-react-router-v8-on-cloudflare-vite.md) | React Router v8 on the Cloudflare Vite plugin | Accepted |
| [0003](0003-hono-api-in-same-worker.md) | Hono API mounted inside the same Worker | Accepted |
| [0004](0004-separate-search-database.md) | FTS5 lives in a separate `SEARCH_DB` | Accepted |
| [0005](0005-d1-sessions-from-day-one.md) | Every D1 query goes through a session | Accepted |
| [0006](0006-arabic-normalizer-twins.md) | Twin Arabic normalizers with shared vectors | Accepted |
| [0007](0007-self-hosted-fonts.md) | Self-hosted fonts through Fontsource | Accepted |
| [0008](0008-bindings-added-per-phase.md) | Bindings are added in the phase that uses them | Accepted |
| [0009](0009-strict-csp-with-nonces.md) | Strict CSP with per-request nonces | Accepted |
| [0010](0010-ci-github-actions.md) | CI on GitHub Actions with Wrangler previews | Proposed |
| [0011](0011-reference-numbering-and-kg-placeholders.md) | Reference numbering by alignment; dataset placeholders become link kinds | Accepted |
| [0012](0012-loaders-instead-of-tanstack-query.md) | React Router loaders instead of TanStack Query and Zustand | Accepted |
| [0013](0013-editorial-workflow.md) | Editorial workflow: proposals, separation of duties, Access verified twice | Accepted |
