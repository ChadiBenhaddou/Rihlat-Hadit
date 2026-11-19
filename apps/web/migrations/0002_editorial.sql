-- Migration 0002: editorial workflow (SPEC §14). Forward-only, additive.

-- Items a human must look at: produced by the pipeline and by public reports.
CREATE TABLE review_items (
  id         INTEGER PRIMARY KEY,
  kind       TEXT NOT NULL,                -- chain_warning, unplaced_kg_entry, honorific_missing, report, …
  entity     TEXT,                         -- 'hadith' | 'narrator' | 'chain' | NULL
  entity_id  INTEGER,
  detail     TEXT NOT NULL,                -- JSON from the producer
  status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
CREATE INDEX review_items_by_status ON review_items(status, kind);
CREATE INDEX review_items_by_entity ON review_items(entity, entity_id);

-- An editor proposes; a different reviewer (or an admin) approves; approval applies it.
CREATE TABLE proposals (
  id             INTEGER PRIMARY KEY,
  review_item_id INTEGER REFERENCES review_items(id),
  kind           TEXT NOT NULL CHECK (kind IN ('set_field','set_link','merge_narrators','add_citation')),
  payload        TEXT NOT NULL,            -- JSON, validated by server/admin/proposals.ts
  reason         TEXT NOT NULL,
  proposed_by    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','rejected','applied')),
  decided_by     TEXT,
  decided_at     TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
CREATE INDEX proposals_by_status ON proposals(status, created_at);
CREATE INDEX proposals_by_item ON proposals(review_item_id);

-- A merged narrator's old slug keeps working.
CREATE TABLE narrator_redirects (
  old_slug    TEXT PRIMARY KEY,
  narrator_id INTEGER NOT NULL REFERENCES narrators(id)
) STRICT;
CREATE INDEX narrator_redirects_by_narrator ON narrator_redirects(narrator_id);
