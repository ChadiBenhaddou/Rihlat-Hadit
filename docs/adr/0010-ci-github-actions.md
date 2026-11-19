# 0010 — CI on GitHub Actions with Wrangler previews

**Status:** Proposed · 2026-11-19 (needs the repository and Cloudflare secrets)

## Context
SPEC §17 allows Workers Builds or GitHub Actions. Python checks (ruff, mypy, pytest) must run in the same CI as TypeScript.

## Decision
`.github/workflows/ci.yml` runs TypeScript (typecheck, lint, Vitest, build), Python (ruff, mypy, pytest) and a source-hygiene job. Pull requests upload a preview version with `wrangler versions upload --preview-alias pr-<n>` after applying preview migrations; pushes to `main` apply migrations, then deploy. Deploy jobs no-op until `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exist.

## Consequences
- One CI system for both languages; Workers Builds would need a second for Python.
- The budget checks of SPEC §15 (Lighthouse, bundle size against the preview) join in Phase 2, when there is a page worth measuring.
