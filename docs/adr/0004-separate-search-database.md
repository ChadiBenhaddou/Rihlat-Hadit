# 0004 — FTS5 lives in a separate `SEARCH_DB`

**Status:** Accepted · 2026-11-19

## Context
D1 cannot export a database that contains virtual tables (FTS5). The core database must be exportable for weekly backups to R2 (SPEC §4, §14).

## Decision
Two D1 databases: `DB` (core, `migrations/`) and `SEARCH_DB` (`migrations-search/`, FTS5 only). The pipeline rebuilds `SEARCH_DB` from `DB` on every publish; it is never edited or backed up.

## Consequences
- Search and core reads cannot be joined in one SQL statement; the Worker queries search first, then fetches rows from `DB` by id (still within the 3-query page budget).
- Two databases also double D1's one-query-at-a-time concurrency.
- Search can drift from core between a core edit and the next rebuild; publishing always rebuilds both.
