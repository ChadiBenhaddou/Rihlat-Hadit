-- Migration 0001: core schema (SPEC §7), database binding DB.
-- Forward-only. Never put FTS5 or other virtual tables here: D1 cannot export
-- a database that contains them (see migrations-search/ and docs/adr/0004).
-- D1 enforces foreign keys by default (PRAGMA foreign_keys is on); no pragma needed.

-- Provenance ---------------------------------------------------------------
CREATE TABLE sources (
  id           INTEGER PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,          -- 'hadith-kg-v1', 'taqrib-al-tahdhib'
  kind         TEXT NOT NULL CHECK (kind IN ('primary_text','biographical','critical','dataset','web')),
  title_ar     TEXT NOT NULL,
  title_en     TEXT,
  author_ar    TEXT,
  edition      TEXT,                          -- publisher, editor (muhaqqiq), year
  url          TEXT,
  license      TEXT NOT NULL,                 -- SPDX id, e.g. 'CC-BY-4.0'
  attribution  TEXT,                          -- exact attribution line to display
  retrieved_at TEXT
) STRICT;

CREATE TABLE citations (
  id        INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  locator   TEXT,                             -- 'vol. 1, p. 9' or a dataset record id
  url       TEXT
) STRICT;

-- Narrators (الرواة) ---------------------------------------------------------
CREATE TABLE narrators (
  id                INTEGER PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,     -- stable, used in URLs
  display_name_ar   TEXT NOT NULL,            -- 'يحيى بن سعيد الأنصاري'
  full_name_ar      TEXT,                     -- with nasab
  kunya_ar          TEXT,
  laqab_ar          TEXT,
  nisba_ar          TEXT,
  name_translit     TEXT,
  gender            TEXT CHECK (gender IN ('m','f')),
  role              TEXT NOT NULL DEFAULT 'narrator'
                    CHECK (role IN ('prophet','companion','narrator','compiler')),
  honorific_ar      TEXT,                     -- 'ﷺ', 'رضي الله عنه' … set in review
  tabaqa            INTEGER,                  -- generation as given by the cited source
  birth_ah          INTEGER,
  death_ah          INTEGER,                  -- earliest reported year
  death_ah_max      INTEGER,                  -- latest reported year when sources differ
  dates_citation_id INTEGER REFERENCES citations(id),
  summary_grade_ar  TEXT,                     -- verbatim, e.g. Ibn Hajar's words in Taqrib
  summary_grade_citation_id INTEGER REFERENCES citations(id),
  review_status     TEXT NOT NULL DEFAULT 'auto'
                    CHECK (review_status IN ('auto','in_review','reviewed','rejected'))
) STRICT;

CREATE TABLE narrator_names (                 -- every attested name form
  narrator_id INTEGER NOT NULL REFERENCES narrators(id),
  form_ar     TEXT NOT NULL,
  form_norm   TEXT NOT NULL,                  -- normalized as in section 9
  kind        TEXT CHECK (kind IN ('ism','kunya','laqab','nisba','short','full')),
  PRIMARY KEY (narrator_id, form_norm)
) STRICT;
CREATE INDEX narrator_names_by_form ON narrator_names(form_norm);

CREATE TABLE narrator_flags (                 -- only when a cited source states it
  narrator_id INTEGER NOT NULL REFERENCES narrators(id),
  flag        TEXT NOT NULL CHECK (flag IN ('tadlis','ikhtilat')),
  note_ar     TEXT,
  citation_id INTEGER NOT NULL REFERENCES citations(id),
  PRIMARY KEY (narrator_id, flag)
) STRICT;

CREATE TABLE places (
  id      INTEGER PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  lat     REAL,
  lon     REAL
) STRICT;

CREATE TABLE narrator_places (
  narrator_id INTEGER NOT NULL REFERENCES narrators(id),
  place_id    INTEGER NOT NULL REFERENCES places(id),
  relation    TEXT NOT NULL CHECK (relation IN ('born','lived','travelled','died')),
  citation_id INTEGER REFERENCES citations(id),
  PRIMARY KEY (narrator_id, place_id, relation)
) STRICT;

CREATE TABLE gradings (                       -- الجرح والتعديل: one attributed statement per row
  id             INTEGER PRIMARY KEY,
  narrator_id    INTEGER NOT NULL REFERENCES narrators(id),
  critic_id      INTEGER REFERENCES narrators(id),
  critic_name_ar TEXT,                        -- when the critic has no narrator row
  statement_ar   TEXT NOT NULL,               -- verbatim, e.g. 'ثقة ثبت'
  citation_id    INTEGER NOT NULL REFERENCES citations(id)
) STRICT;
CREATE INDEX gradings_by_narrator ON gradings(narrator_id);

-- Collections and entries -------------------------------------------------
CREATE TABLE collections (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,           -- 'bukhari'
  name_ar     TEXT NOT NULL,
  name_en     TEXT,
  compiler_id INTEGER REFERENCES narrators(id)
) STRICT;

CREATE TABLE books (                          -- الكتب
  id            INTEGER PRIMARY KEY,
  collection_id INTEGER NOT NULL REFERENCES collections(id),
  number        INTEGER NOT NULL,
  title_ar      TEXT NOT NULL,
  title_en      TEXT,
  UNIQUE (collection_id, number)
) STRICT;

CREATE TABLE chapters (                       -- الأبواب, with al-Bukhari's chapter titles
  id       INTEGER PRIMARY KEY,
  book_id  INTEGER NOT NULL REFERENCES books(id),
  number   INTEGER,
  title_ar TEXT NOT NULL,
  title_en TEXT
) STRICT;
CREATE INDEX chapters_by_book ON chapters(book_id);

CREATE TABLE hadith_groups (                  -- entries that are the same hadith ("all routes")
  id            INTEGER PRIMARY KEY,
  label_ar      TEXT,
  method        TEXT NOT NULL CHECK (method IN ('dataset','manual','suggested')),
  review_status TEXT NOT NULL DEFAULT 'auto'
                CHECK (review_status IN ('auto','in_review','reviewed','rejected'))
) STRICT;

CREATE TABLE hadiths (                        -- one row per numbered entry
  id            INTEGER PRIMARY KEY,
  collection_id INTEGER NOT NULL REFERENCES collections(id),
  chapter_id    INTEGER REFERENCES chapters(id),
  ref_number    INTEGER NOT NULL,             -- the collection's reference numbering
  text_ar       TEXT NOT NULL,                -- as in the source, with tashkeel
  isnad_ar      TEXT,
  matn_ar       TEXT,
  group_id      INTEGER REFERENCES hadith_groups(id),
  citation_id   INTEGER NOT NULL REFERENCES citations(id),
  review_status TEXT NOT NULL DEFAULT 'auto'
                CHECK (review_status IN ('auto','in_review','reviewed','rejected')),
  UNIQUE (collection_id, ref_number)
) STRICT;
CREATE INDEX hadiths_by_chapter ON hadiths(chapter_id);
CREATE INDEX hadiths_by_group ON hadiths(group_id);

CREATE TABLE hadith_numbers (                 -- other numbering schemes
  hadith_id INTEGER NOT NULL REFERENCES hadiths(id),
  scheme    TEXT NOT NULL,                    -- e.g. 'in-book', 'sultaniyya'
  value     TEXT NOT NULL,
  PRIMARY KEY (scheme, value)
) STRICT;

-- Chains -------------------------------------------------------------------
CREATE TABLE chains (                         -- one route (طريق); ح splits an entry into several
  id            INTEGER PRIMARY KEY,
  hadith_id     INTEGER NOT NULL REFERENCES hadiths(id),
  route_no      INTEGER NOT NULL,
  terminus      TEXT NOT NULL CHECK (terminus IN ('prophet','companion','successor','other')),
  is_suspended  INTEGER NOT NULL DEFAULT 0,   -- معلق
  citation_id   INTEGER REFERENCES citations(id),
  review_status TEXT NOT NULL DEFAULT 'auto'
                CHECK (review_status IN ('auto','in_review','reviewed','rejected')),
  UNIQUE (hadith_id, route_no)
) STRICT;

CREATE TABLE chain_links (                    -- position 0 = al-Bukhari, rising toward the source
  chain_id      INTEGER NOT NULL REFERENCES chains(id),
  position      INTEGER NOT NULL,
  narrator_id   INTEGER REFERENCES narrators(id),  -- NULL while unresolved
  mention_ar    TEXT NOT NULL,                -- the name exactly as written here
  mention_start INTEGER,                      -- character offsets in hadiths.isnad_ar
  mention_end   INTEGER,
  term_ar       TEXT,                         -- phrase used by the narrator at position-1:
                                              -- حدثنا، أخبرنا، عن، سمعت …
  link_kind     TEXT NOT NULL DEFAULT 'connected'
                CHECK (link_kind IN ('connected','suspended','gap','uncertain')),
  resolution    TEXT NOT NULL DEFAULT 'auto'
                CHECK (resolution IN ('dataset','auto','manual','unresolved')),
  confidence    REAL,
  PRIMARY KEY (chain_id, position)
) STRICT;
CREATE INDEX chain_links_by_narrator ON chain_links(narrator_id);

CREATE TABLE transmissions (                  -- derived from chain_links; never hand-edited
  teacher_id   INTEGER NOT NULL REFERENCES narrators(id),
  student_id   INTEGER NOT NULL REFERENCES narrators(id),
  hadith_count INTEGER NOT NULL,
  PRIMARY KEY (teacher_id, student_id)
) STRICT;
CREATE INDEX transmissions_by_student ON transmissions(student_id);

-- Editorial ----------------------------------------------------------------
CREATE TABLE staff (
  email TEXT PRIMARY KEY,
  role  TEXT NOT NULL CHECK (role IN ('editor','reviewer','admin'))
) STRICT;

CREATE TABLE revisions (
  id          INTEGER PRIMARY KEY,
  entity      TEXT NOT NULL,
  entity_id   INTEGER NOT NULL,
  field       TEXT,
  old_value   TEXT,
  new_value   TEXT,
  actor_email TEXT NOT NULL,
  reason      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

CREATE TABLE reports (                        -- public «الإبلاغ عن خطأ»
  id         INTEGER PRIMARY KEY,
  entity     TEXT NOT NULL,
  entity_id  INTEGER NOT NULL,
  message    TEXT NOT NULL,
  contact    TEXT,
  status     TEXT NOT NULL DEFAULT 'open'
             CHECK (status IN ('open','accepted','rejected','duplicate')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

CREATE TABLE data_versions (
  id           INTEGER PRIMARY KEY,
  label        TEXT NOT NULL UNIQUE,
  published_at TEXT NOT NULL,
  notes        TEXT
) STRICT;

-- Indexes on foreign-key columns used in lookups (SPEC §7 invariant) -------
-- Columns already leading a PRIMARY KEY or UNIQUE constraint are covered.
CREATE INDEX citations_by_source     ON citations(source_id);
CREATE INDEX narrators_by_tabaqa     ON narrators(tabaqa);
CREATE INDEX narrator_places_by_place ON narrator_places(place_id);
CREATE INDEX gradings_by_critic      ON gradings(critic_id);
CREATE INDEX hadith_numbers_by_hadith ON hadith_numbers(hadith_id);
CREATE INDEX revisions_by_entity     ON revisions(entity, entity_id);
CREATE INDEX reports_by_status       ON reports(status, created_at);
