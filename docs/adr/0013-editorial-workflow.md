# 0013 — Editorial workflow: proposals, separation of duties, Access verified twice

**Status:** Accepted · 2026-11-19

## Context
SPEC §14: editors propose, reviewers approve, admins publish; approved changes apply in one D1 batch with one revision per field. `/admin` sits behind Cloudflare Access, and the Worker verifies the JWT again.

## Decision
- **Migration 0002** adds `review_items` (loaded by the pipeline from its review queue, plus one item per companion without an honorific), `proposals` and `narrator_redirects`.
- **Proposal kinds:** `set_field` (a fixed whitelist of fields per entity), `set_link` (narrator, link kind, phrase), `merge_narrators` (the old slug becomes a 301 redirect) and `add_citation` (a citation on a narrator's dates or summary grade; a cited summary grade becomes visible). Narrator *split* is not built yet.
- **Separation of duties:** a proposal is decided by someone other than its author; admins may decide their own.
- **Applying** happens in one batch: the change, its `revisions` rows, the closing of the review item, and a full rebuild of the derived `transmissions` table.
- **Authentication:** `server/admin/access.ts` verifies the RS256 signature against `https://<team>/cdn-cgi/access/certs`, plus audience, issuer, expiry and nbf; then it looks up the `staff` role. A DEV build accepts `DEV_ADMIN_EMAIL` from `.dev.vars`; production builds compile that branch out (`import.meta.env.DEV`).
- **Publishing** inserts a `data_versions` row and sets `CONFIG.data_version`. `SEARCH_DB` is not rebuilt by publishing; renamed narrators reach search on the next pipeline build.

## Consequences
- Every public change has a reason and a named actor in `revisions`.
- The rebuild of `transmissions` is a full table rewrite; fine at Bukhari's size (about 4k rows), to revisit for larger collections.
