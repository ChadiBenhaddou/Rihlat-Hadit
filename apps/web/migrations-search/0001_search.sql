-- Migration 0001: search schema (SPEC §7), database binding SEARCH_DB.
-- Derived data only: rebuilt from the core database by the pipeline, never
-- edited directly, never backed up (rebuild instead).
CREATE VIRTUAL TABLE matn_fts USING fts5(
  hadith_id UNINDEXED, collection UNINDEXED,
  surface,                                    -- normalized tokens
  stem,                                       -- light-stemmed tokens
  tokenize = 'unicode61', prefix = '2 3'
);
CREATE VIRTUAL TABLE narrator_fts USING fts5(
  narrator_id UNINDEXED, surface, stem,
  tokenize = 'unicode61', prefix = '2 3'
);
