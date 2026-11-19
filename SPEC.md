# رحلة الحديث — Full Build Prompt for Cloudflare Workers

Nov 19, 2026 · @Sir Chadi

## How to use this prompt

Export this doc as Markdown, commit it as `SPEC.md` in an empty repository, and tell your coding agent: "Read SPEC.md and start Phase 0." You can also paste everything from section 1 onward straight into the agent.

Two open questions from the original concept are settled here. The view is 2D-first with an optional 3D mode, the hybrid option the concept preferred. Python stays only in the offline data pipeline, because the runtime on Workers is TypeScript.&#32;&#32;

## 1. Role and mission

You are a senior full-stack and data engineer who knows the vocabulary of hadith sciences (علوم الحديث). Build **رحلة الحديث في صحيح البخاري** ("The Journey of a Hadith in Sahih al-Bukhari") and host all of it on Cloudflare Workers.

The platform turns each isnad (chain of narration) from a line of text into an animated, explorable graph. A visitor watches a hadith travel from the Prophet ﷺ through the Companions, the Successors and later narrators to al-Bukhari. Then they explore every other route of the same hadith.

The long-term vision is a visual, interactive encyclopedia of isnad science (موسوعة بصرية تفاعلية لعلم الإسناد). Release 1 covers Sahih al-Bukhari only. The data model must still accept Sahih Muslim and the Sunan later, without a schema rewrite.

The product succeeds when a researcher can:

1. Open any hadith of Sahih al-Bukhari by number, by words of its text, or by narrator.
2. Watch its chain animate narrator by narrator, with the mode of transmission shown on every link.
3. See all routes of the same hadith: where they converge on a common link (مدار) and where they split.
4. Open any narrator and read a sourced biography, teachers, students and critics' statements.
5. Trust every fact on screen, because each one cites its source and shows its review status.

## 2. Product vision and core experiences

The interface has three linked panes, as in the concept. The hadith pane shows the text, book, chapter and number; explanations (شرح) wait until a licensed, cited commentary is approved. The isnad pane shows all routes as an animated graph. The narrator pane is the encyclopedia of biographies and relations. Selecting anything in one pane updates the other two.

| # | Experience | What the user can do | Phase |
| --- | --- | --- | --- |
| أ | استكشاف الحديث — Hadith explorer | Search by hadith number in several numbering schemes, by words of the matn with or without tashkeel, or by narrator name. Browse by كتاب and باب. | 2 |
| ب | استكشاف الإسناد — Isnad journey | Press «استكشاف الإسناد» and watch the chain animate link by link. Each narrator card appears in turn, and each link shows its transmission phrase (حدثنا، أخبرنا، عن، سمعت). | 2 |
| ج | استكشاف جميع الطرق — All routes | Overlay every route of the same hadith. Highlight common links (مدار), divergence points, and short (عالٍ) versus long (نازل) chains. | 3 |
| د | استكشاف الرواة — Narrator network | Start from one narrator, expand teachers and students hop by hop, and list the hadith two narrators share. | 3 |
| هـ | المقارنة بين الروايات — Compare narrations | Diff the matn wordings of two routes word by word (additions, omissions, changed words) and compare their chains side by side, each linked to its source. | 4 |

The isnad journey runs in two directions, chosen by a toggle:

- **تتبّع الإسناد (trace the chain):** starts at al-Bukhari and climbs teacher by teacher to the Prophet ﷺ. This is the order in which a reader reads an isnad.
- **رحلة النقل (the transmission journey):** starts at the Prophet ﷺ and descends generation by generation to al-Bukhari. This is the order in which the hadith actually travelled.

A narrator profile shows whatever the sources provide: full name, nasab, kunya, laqab and nisba; birth and death years in AH with CE; teachers and students; cities lived in and travelled to; generation (طبقة); attributed critics' statements (الجرح والتعديل); every hadith they transmit in Sahih al-Bukhari; and the other routes of each of those hadith.

## 3. Non-negotiable principles

These rules override every other instruction in this prompt, including deadlines and visual polish.

1. **A research tool first, visuals second.** The platform must stand on reliable sources. Beautiful graphs over unsourced data count as failure.
2. **No automatic verdicts.** A connected line is never evidence that a hadith is authentic. Never compute or display an authenticity grade. Show the statements of named scholars with their sources, and label every computed signal «مؤشر للباحث» (an indicator for the researcher), never a ruling.
3. **Provenance on every fact.** Every matn, chain, link, narrator field and critic's statement cites a source (work, edition, volume and page, or URL) and carries a review status. Unreviewed data shows a visible badge: «مستخرج آلياً — لم يُراجَع».
4. **Never invent data.** Do not fill names, dates, chains or gradings from your own memory. Missing values stay `NULL` and display «غير متوفر». Test fixtures are labelled as fixtures and never ship as content.
5. **Respect what al-Bukhari actually wrote.** Keep the Sahih separate from his other works, such as al-Tarikh al-Kabir and al-Adab al-Mufrad. The concept's example «ذكاة الجنين ذكاة أمه» is narrated in Sunan Abi Dawud and al-Tirmidhi, not as a musnad hadith of the Sahih. Never use it as a Bukhari demo; use hadith no. 1, «إنما الأعمال بالنيات».
6. **Model gaps and chain switches explicitly.** A suspended narration (معلق) is drawn with a visibly broken link, never a solid line. The chain-switch sign (ح, تحويل) splits one entry into several routes that share links.
7. **No depictions.** No images, avatars, silhouettes or figurative art for the Prophet ﷺ, the Companions or any narrator. Nodes are typographic. No confetti, sound effects, streaks or gamification around sacred text.
8. **Honorifics come from data.** Render ﷺ after the Prophet's name and رضي الله عنه / عنها / عنهما after Companions from a per-narrator `honorific` field set in review. Never derive them by string matching.
9. **Arabic first.** Use an RTL layout and an Arabic UI by default. Show hadith text with the tashkeel of its source. Make search ignore tashkeel and letter variants.
10. **Licensed data only.** Record the license of every source. Do not ingest a dataset or translation whose license forbids redistribution; most English translations of the Sahih are under copyright.

## 4. Hosting target: Cloudflare Workers

Run everything on the Workers Paid plan. The Free plan allows 10 ms of CPU per request and 500 MB per D1 database, which is too little for server rendering plus graph assembly. The figures below were checked on 19 November 2026; re-check the linked page before relying on one.

| Constraint (Workers Paid) | Current value | What it forces in this design |
| --- | --- | --- |
| CPU time per request | 30 s default, 5 min maximum | Keep SSR plus graph assembly in tens of milliseconds; run bulk work offline or in Workflows |
| Memory per isolate | 128 MB | Never load the whole narrator network; query per hadith or per ego network |
| Worker size and startup | 64 MiB uncompressed; 1 s startup | Keep graph, 3D and map libraries out of the server bundle; ship them as lazy-loaded static assets |
| Static assets | 100,000 files per version, 25 MiB per file | Fonts and JS chunks go in assets; map tiles go in R2 |
| D1 database size | 10 GB per database, cannot be raised | Bukhari fits easily; later collections may need one database per collection family |
| D1 queries per invocation | 1,000; a `batch()` counts as one | Assemble each page or graph in at most 3 queries |
| D1 bound parameters | 100 per query | Chunk bulk writes and `IN (…)` lists |
| D1 statement length | 100 KB | The pipeline emits many small statements |
| D1 query duration | 30 s | Index every lookup column; no full scans at request time |
| D1 result size | 50 MB per query, from 4 Nov 2026 | Paginate every list endpoint |
| D1 concurrency | One query at a time per database | A 1 ms query allows about 1,000 queries per second, so cache aggressively |
| D1 export | Not supported for databases that contain virtual tables (FTS5) | Keep FTS5 in a separate, rebuildable search database |
| D1 Time Travel | 30-day point-in-time restore | First line of backup, plus weekly exports of the core database to R2 |
| D1 read replication | Opt-in (beta), and only through the Sessions API (`env.DB.withSession()`) | Route every query through a session from day one, so replicas can be switched on later |
| Vectorize | 1,536 dimensions, 20 M vectors per index, 10 metadata indexes, topK 50 with metadata | Fits bge-m3; create metadata indexes before the first insert |
| Workers AI embeddings | `@cf/baai/bge-m3`, multilingual, 60,000-token context | Arabic matn embeddings for semantic search |
| Rate Limiting binding | Configured under `ratelimits`; window of 10 or 60 s | Protect search, the API and the report form |

Sources: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits), [D1 import and export](https://developers.cloudflare.com/d1/best-practices/import-export-data/), [D1 read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/), [Vectorize limits](https://developers.cloudflare.com/vectorize/platform/limits), [bge-m3 on Workers AI](https://developers.cloudflare.com/workers-ai/models/bge-m3/), [Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

## 5. Architecture and stack

One Worker serves everything: server-rendered pages, the JSON API and static assets. Python remains only in an offline pipeline that builds the data and loads it into D1.

&#91;embedded content: architecture · one Worker, six bindings, an offline pipeline\]

Readers and staff reach one Worker, which touches storage only through bindings. Bulk data arrives only from the offline pipeline, and each publish bumps the data version that keys every cache.

| Concern | Concept proposed | On Cloudflare | Why |
| --- | --- | --- | --- |
| Pages | React or Next.js | React Router in framework mode, scaffolded with `npm create cloudflare@latest -- <app> --framework=react-router` (v8 as of Nov 2026), on the Cloudflare Vite plugin | The official Workers integration; SSR makes every hadith and narrator page indexable |
| API | Python + FastAPI | TypeScript with Hono, mounted at `/api/v1` in the same Worker | Native runtime with direct D1 bindings; one deploy |
| Isnad graphs | D3.js | D3 (zoom, shapes, transitions) over SVG, with an elkjs layered layout in a Web Worker | An isnad graph is a small layered DAG; SVG keeps Arabic text crisp and accessible |
| Narrator network | D3.js | Sigma.js + graphology (WebGL) | Thousands of nodes need WebGL |
| 3D | Three.js | 3d-force-graph (Three.js), lazy-loaded, Phase 5 | An optional view, never in the main bundle |
| Relational data | PostgreSQL | D1 (SQLite), core database `DB` | Serverless and bound to the Worker; Bukhari is far below 10 GB |
| Graph queries | Neo4j | Adjacency tables, recursive CTEs and a derived `transmissions` table | Chains are short (about ten links at most) and each hadith's graph is small |
| Search | OpenSearch | FTS5 in a second D1 database `SEARCH_DB`, plus Vectorize, fused with reciprocal rank fusion | No cluster to run; FTS5 stays out of the exportable core database |
| Files | — | R2 bucket `DATA` | Raw sources, pipeline outputs, exports, map tiles |
| Config | — | KV namespace `CONFIG` | Active data version and feature flags |
| Admin auth | — | Cloudflare Access, with the JWT verified again in the Worker | No passwords to store |
| Pipeline | Python | Python 3.12+ with uv, run locally or in CI, never on Workers | Python's Arabic NLP and data tooling |

Inside the Worker, `workers/app.ts` creates a Hono app, mounts the API at `/api/v1`, and hands every other request to the React Router handler with `{ cloudflare: { env, ctx } }`. Loaders call the same data-access layer as the API; they never call the API over HTTP.

On the client, use strict TypeScript, Tailwind CSS with logical properties only (`ms-`, `pe-`, `start-`), and Radix UI primitives under `DirectionProvider dir="rtl"`. Use TanStack Query for server data and Zustand for transient UI state. Shared zod schemas in `packages/shared` define every payload, for the Worker, the client and the tests alike.

## 6. Repository layout

Use one pnpm monorepo with a single deployable Worker. Pure logic lives in packages so it can be tested without the runtime.

```text
isnad-journey/
├─ apps/web/                 # the one Worker: React Router SSR + Hono API + static assets
│  ├─ app/                   # routes, components, graph renderers (client)
│  ├─ server/                # Hono API, data access, caching, Access JWT checks
│  ├─ workers/app.ts         # entry: /api/v1 → Hono, everything else → React Router
│  ├─ migrations/            # D1 migrations for DB (core)
│  ├─ migrations-search/     # D1 migrations for SEARCH_DB (FTS5 only)
│  └─ wrangler.jsonc
├─ packages/
│  ├─ shared/                # zod schemas, API types, Arabic normalizer (TypeScript)
│  └─ graph/                 # route merging, common link, layering, indicators
├─ pipeline/                 # Python: adapters, parsing, resolution, validation, loaders
│  ├─ adapters/              # one module per data source
│  ├─ isnad/                 # mention and transmission-term extraction, ح splitting
│  ├─ resolve/               # narrator disambiguation
│  ├─ normalize/             # Arabic normalizer (Python twin of the TS one)
│  ├─ tests/
│  └─ pyproject.toml
├─ fixtures/                 # labelled test fixtures, incl. normalization-cases.json
├─ docs/                     # adr/, data-sources.md, methodology.md
└─ .github/workflows/
```

Never commit raw source data to git. Store it in R2 under `raw/<source>/<version>/`, with its checksum and license file beside it.

## 7. Data model (D1)

The core database stores every route of every entry as ordered links, plus sourced narrator data. Start from this schema; you may refine it, but keep the invariants listed under it.

```sql
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
```

The search database holds only FTS5 tables and is rebuilt from the core database by the pipeline:

```sql
-- SEARCH_DB (separate D1 database; never edited directly)
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
```

Invariants:

- Every public fact reaches a `citations` row, directly or through its parent row.
- `chain_links` keeps `mention_ar` and its offsets after resolution, so the isnad text and the graph stay linked.
- Position 0 of every chain is the compiler, with no mention offsets. A suspended chain marks its first named link `suspended`.
- `transmissions`, common links and all of `SEARCH_DB` are derived data: rebuild them, never edit them.
- IDs and slugs stay stable across data versions. The pipeline upserts by natural keys (collection + `ref_number`, source slug + locator, narrator slug).
- Foreign keys are on, and every foreign-key column used in a lookup has an index.

## 8. Data sources, ingestion and verification

Phase 1 opens with a source evaluation, and nothing is ingested at scale until a human approves its report. The candidates below were found on 19 November 2026; verify each license and coverage claim yourself.

| Source | What it offers | License | Intended use |
| --- | --- | --- | --- |
| [Hadith Knowledge Graph «الجامع»](https://huggingface.co/datasets/emadjumaah/hadith-kg) (Hugging Face) | 715,790 hadith from 425 collections; 577,024 complete chains stored as ordered narrator links; 49,819 narrator biographies; 127,863 critics' statements; 20,745 groups of same-matn narrations; SQLite files | CC BY 4.0 | Main candidate for chains, narrators and route groups. Its page does not name its source works, so verify provenance and Bukhari coverage first. |
| [Sanadset 650K](https://data.mendeley.com/datasets/5xth87zwb5) (Mendeley Data) | 650,986 records from 926 books, with narrator chains extracted from the text as written | CC BY 4.0 | Second source to cross-check chains; its names still need resolution |
| [AR-Sanad 280K](https://www.mdpi.com/2078-2489/13/2/55) | Artificial sanads over 18,298 narrators, with each narrator's attested name forms (صور الورود) | Not stated; ask the authors | Train and evaluate the resolver; harvest name variants |
| [OpenITI corpus](https://zenodo.org/records/17767721), release 2025.1.9 | Machine-readable classical Arabic texts, including biographical dictionaries | CC BY-NC-SA 4.0 | Verbatim critics' statements and text cross-checks. Non-commercial and share-alike, so record attribution. |
| [Sunnah.com API](https://sunnah.com/developers) | Collections, numbering and chapter structure | API key on request | Cross-check numbering and link out, only with permission |

Prior art to study, not copy: [Ilm](https://arriqaaq.com/ilm/articles/launch.html) draws Sigma.js narrator graphs layered by tabaqa and runs hybrid BM25 plus BGE-M3 search. Its Arabic search tokenizes only; this project adds light stemming.

The pipeline runs in this order:

1. **Acquire.** Download each source to R2 under `raw/<source>/<version>/` with its checksum, license text and retrieval date, and create its `sources` row.
2. **Evaluate, then stop.** For each candidate, measure Bukhari coverage against the reference numbering (sunnah.com counts about [7,563 hadith in 97 books](https://sunnah.com/llms.txt)), chain completeness, the share of mentions already tied to narrator IDs, grading coverage, provenance and license fit. Write `docs/data-sources.md` and wait for approval.
3. **Parse.** Split isnad from matn where the source has not. Split routes at ح. Extract every mention with its offsets and the transmission phrase before it. Detect suspended entries.
4. **Resolve narrators.** Prefer IDs supplied by an approved dataset. Otherwise generate candidates from `narrator_names` by normalized form and score them with graph constraints: the candidate must be a known teacher of the previous narrator or a student of the next one, and lifespans must overlap where dates exist. Calibrate the confidence threshold on at least 300 hand-checked mentions. Below it, store the mention as unresolved and queue it; never choose silently.
5. **Validate.** Positions are contiguous, no narrator repeats within a chain, every chain starts with the compiler and has a terminus, every referenced row exists, and dates are plausible. Errors fail the run; warnings become review items.
6. **Cross-check.** Compare each chain with a second source and queue every disagreement.
7. **Derive.** Rebuild `transmissions`, common links and per-layer counts. Import route groups from an approved dataset or from curation.
8. **Load.** Emit chunked SQL within D1's limits and import it with `wrangler d1 execute --remote --file`, into a fresh preview database first. Rebuild `SEARCH_DB`. Embed each matn and upsert vectors in batches of at most 5,000 through the HTTP API. Load production the same way once the preview checks pass.
9. **Publish.** Insert a `data_versions` row and set `CONFIG.data_version`. Caches turn over on their own, because every cache key includes the version.

A dataset counts as a source. A fact that rests only on a dataset is labelled «مصدر ثانوي» (secondary source) in the UI until a reviewer adds a primary citation.

## 9. Arabic text processing and search

Search must find «إنما الأعمال بالنيات» whether the user types it with full tashkeel, without any, or with different hamza or taa marbuta spellings. One normalizer does this, implemented twice: TypeScript for queries, Python for ingestion. Both must pass the same `fixtures/normalization-cases.json`. Normalized text is for matching only; the UI always displays the source text.

Normalize in this order:

1. Apply Unicode NFKC. It also folds Arabic presentation forms, so ﷺ becomes صلى الله عليه وسلم.
2. Remove tashkeel and Quranic marks (U+064B–U+065F, U+0670, U+06D6–U+06ED) and the tatweel (U+0640).
3. Fold letter variants: أ إ آ ٱ → ا; ى → ي; ة → ه; ؤ → و; ئ → ي; Persian ک → ك and ی → ي.
4. Convert Arabic-Indic digits (U+0660–U+0669, U+06F0–U+06F9) to 0–9.
5. Turn punctuation, including ، ؛ ؟ « », into spaces and collapse whitespace.

Light stemming produces the `stem` column; the normalized token is the `surface` column:

- Strip the longest matching proclitic from وال، بال، كال، فال، لل، ال، و, but only if at least 3 letters remain. If it fails, try the shorter ones.
- Never stem protected words such as الله and اللهم. Release 1 strips no suffixes.
- Expected results: بالنيات → نيات; الاعمال → اعمال; والله → الله; كتاب stays كتاب.

Text search (Phase 1):

- Normalize and stem the query with the same code. Match each token against `surface` or `stem`, with prefix matching; AND the tokens; treat quoted text as a phrase.
- Rank with `bm25(matn_fts, 0, 0, 2.0, 1.0)`, so surface matches outrank stem matches.
- Highlight on the original text: tokenize it with tashkeel intact, normalize each token, and mark tokens that match a query term.
- A query made only of digits is a hadith-number lookup first. Use the collection's reference numbering, keep in-book references as a second scheme, and never use the USC-MSA numbering, which [sunnah.com](https://sunnah.com/llms.txt) marks as deprecated.
- Narrator search runs the same normalizer over `narrator_names`. Show death year, city and tabaqa in every result, because many narrators share names.

Semantic search (Phase 4):

- Embed each matn, with tashkeel removed and letters otherwise intact, using `@cf/baai/bge-m3`. Check the model page's current input schema, and read the vector length from the first response (1024 is expected) before creating the index.
- Create the Vectorize index `isnad-matn-bge-m3` with the cosine metric. Create metadata indexes for `collection` and `group_id` before the first upsert.
- Embed the query at request time through the AI binding, and query with topK of at most 50.
- Hybrid mode fuses text and vector rankings with reciprocal rank fusion (k = 60). Label results that only semantic search found «نتيجة دلالية», so users know why they matched.
- Similar matns become suggested members of a route group. A reviewer must confirm a suggestion before it joins a group.
- Before shipping, judge 30 Arabic queries by hand and report recall@10 for text, semantic and hybrid modes.

## 10. API contract

All endpoints live under `/api/v1`, return JSON validated by the shared zod schemas, and are described at `/api/v1/openapi.json`. Errors use RFC 9457 problem details.

| Method and path | Returns | Notes |
| --- | --- | --- |
| `GET /version` | Current data version | `max-age=60` |
| `GET /collections` | Collections with book counts |  |
| `GET /collections/:slug/books` | Books (كتب) with their chapters (أبواب) |  |
| `GET /hadith/:collection/:number` | Entry: text, isnad, matn, chapter, numbers, citation, review status, routes |  |
| `GET /hadith/:collection/:number/graph` | Graph payload for this entry's routes | At most 3 D1 queries, in one batch |
| `GET /groups/:id/graph` | Merged graph of every route in a group, with indicators | Powers "all routes" |
| `GET /compare?a=:collection/:number&b=:collection/:number` | Matn token diff and chain alignment |  |
| `GET /narrators/:slug` | Profile: names, dates, places, flags, gradings and counts, each cited |  |
| `GET /narrators/:slug/network?depth=1&limit=200` | Ego network from `transmissions` | Depth at most 2, nodes at most 500 |
| `GET /narrators/:a/shared/:b` | Entries where the two are adjacent in a chain | Paginated |
| `GET /search?q=&type=hadith\|narrator&mode=text\|semantic\|hybrid&cursor=` | Ranked results with highlight tokens | Rate-limited |
| `POST /reports` | `201 Created` | Turnstile token required; rate-limited |
| `/admin/*` | Review queue, edits, publish | Access JWT and `staff` role checked in the Worker |

Caching follows the data version:

- Every read endpoint also exists under `/api/v1/d/:dataVersion/…`. Those responses are immutable: `Cache-Control: public, max-age=31536000, immutable`.
- Unversioned paths resolve the current version from `CONFIG` and answer with `max-age=60`.
- SSR pages embed the data version, so the client always fetches versioned URLs.
- The Worker stores versioned responses with the Cache API, keyed by the full URL.

The graph payload is the contract between the API and every renderer:

```ts
type ReviewStatus = 'auto' | 'in_review' | 'reviewed' | 'rejected';

interface IsnadGraph {
  dataVersion: string;
  scope: { kind: 'hadith'; collection: string; number: number }
       | { kind: 'group'; groupId: number };
  nodes: Array<{
    id: string;                  // 'n:<narratorId>', or 'u:<chainId>:<position>' if unresolved
    narratorId?: number;
    slug?: string;
    nameAr: string;              // the mention text when unresolved
    honorificAr?: string;
    role: 'prophet' | 'companion' | 'narrator' | 'compiler' | 'unresolved';
    tabaqa?: number;
    birthAh?: number;
    deathAh?: number;
    deathAhMax?: number;
    summaryGradeAr?: string;
    citationIds: number[];
    reviewStatus: ReviewStatus;
  }>;
  edges: Array<{                 // teacher → student: the direction of transmission
    from: string;
    to: string;
    termAr?: string;             // حدثنا، أخبرنا، عن، سمعت …
    kind: 'connected' | 'suspended' | 'gap' | 'uncertain';
    chainIds: number[];          // routes that use this link
  }>;
  chains: Array<{
    id: number;
    hadithNumber: number;
    routeNo: number;
    nodeIds: string[];           // index 0 = al-Bukhari, last = the source
    isSuspended: boolean;
    terminus: 'prophet' | 'companion' | 'successor' | 'other';
  }>;
  indicators: Indicator[];       // section 13
  citations: Array<{ id: number; sourceSlug: string; locator?: string; url?: string }>;
}
```

## 11. Frontend pages and UX

Every page is server-rendered in Arabic first, and every view state lives in the URL, so any view can be shared.

| Route | Page |
| --- | --- |
| `/` | Search box, a featured journey through Bukhari no. 1, and a short explanation of what an isnad is |
| `/bukhari`, `/bukhari/kitab/:n` | Books, then chapters with al-Bukhari's chapter titles, then entries |
| `/bukhari/:number` | The three-pane hadith page. View state is in the query string, e.g. `?route=2&mode=journey&dir=trace&step=3&layout=timeline` |
| `/narrator/:slug` | Profile, ego network and the narrator's entries |
| `/compare/:a/:b` | Compare narrations |
| `/search?q=` | Results |
| `/methodology` | منهجية المنصة: how data is sourced, reviewed and shown, and what each indicator means |
| `/sources` | Every source with its license and required attribution |
| `/admin/*` | Editorial tools (section 14) |
| `/en/…` | English UI, from Phase 4 |

Layout by screen size:

- **Desktop (1200 px and up):** three panes. In RTL the hadith pane sits at the start (right), the graph in the middle, and the narrator pane at the end (left).
- **Tablet:** the graph plus one pane; the other opens as a drawer.
- **Mobile:** the graph runs full width; the hadith text and the narrator card open as bottom sheets; journey controls stay fixed at the bottom.

Interactions:

- Hovering or focusing a narrator's name in the isnad text highlights the node, and the reverse, using the stored mention offsets.
- Every fact carries a review badge and a citation popover.
- Every hadith and narrator page has a «الإبلاغ عن خطأ» button.

Typography and visual language:

- Hadith text: Amiri or Scheherazade New, 22–26 px on desktop, with a line height of at least 1.9 so tashkeel never collides.
- Interface text: IBM Plex Sans Arabic or Noto Sans Arabic. All four fonts use the SIL Open Font License.
- Self-host WOFF2 subsets with no third-party font CDN, and preload the hadith font.
- Use Western digits by default, with an Arabic-Indic option. Show Hijri years first and the CE year as an approximation (CE ≈ 0.97 × AH + 622), e.g. «ت 144 هـ (نحو 761 م)».
- Generation (tabaqa) drives a sequential color ramp. Line style, never color alone, encodes link kind: solid for connected, dashed for uncertain, broken for gap or suspended.
- Keep a calm, scholarly palette in light and dark themes, with WCAG AA contrast for all text and lines.

## 12. Visualization and animation

Transmission flows from top to bottom: the Prophet ﷺ at the top, al-Bukhari at the bottom. A vertical axis sidesteps the left-right ambiguity of an RTL page.

Two layouts, switchable at any time:

- **Layered (default):** elkjs `layered`, direction DOWN, running in a Web Worker. A narrator appears once even when several routes pass through them; that merge is what makes convergence visible.
- **Timeline:** the vertical axis is the death year in AH, with lifespan bars where birth years are known. A narrator without dates sits between their chain neighbours with a dashed outline and no year label, and the tooltip says «سنة الوفاة غير متوفرة». The layout never implies a date the sources do not give.

Isnad journey (ب), step by step:

1. On start, the graph dims to 15% opacity and the chosen route is selected. A route picker appears when the entry has several routes.
2. Each step lasts 1.2 s at 1× speed. The link draws itself in 600 ms (stroke-dashoffset, ease-in-out), its transmission phrase fades in at the midpoint, and the next node scales from 0.9 to 1 while its card slides in.
3. The card shows name, kunya, death year, city, and the summary grade with its citation.
4. The camera pans and zooms over 500 ms to keep the active pair centred.
5. Controls: play and pause (Space), previous and next step (arrow keys follow reading direction, so ← is next in RTL), restart, speed 0.5× / 1× / 2×, the direction toggle (تتبّع الإسناد ↔ رحلة النقل), and the route picker.
6. At the end, the whole route stays highlighted, and a summary lists the number of links, the phrases used, any gaps, and the indicators.
7. Under `prefers-reduced-motion`, steps switch instantly and autoplay is off.
8. The text alternative is a synchronized ordered list of the chain, announced through `aria-live="polite"`.

All routes (ج):

- Draw every route in the hadith's group as one merged graph. Edge thickness counts the routes that use each link.
- Mark the common link (مدار) with a ring and a label, as an indicator, and mark the divergence points.
- Animate the routes growing in parallel from the source downward, one hue each, so the viewer watches them converge.
- Filter by al-Bukhari's own teacher (شيخ البخاري) or by chain length, or hide uncertain links. Clicking a link lists the entries that use it.

Narrator network (د):

- Use Sigma.js with graphology. Show an ego network of depth 1 by default, expand it on click, and cap each view at 500 nodes.
- Offer a ForceAtlas2 layout (in a Web Worker) and a layout layered by tabaqa.
- Selecting two narrators lists the entries where they are adjacent in a chain.

Compare narrations (هـ):

- Diff two matns token by token on normalized tokens, but render the original text with tashkeel. Mark additions, omissions and substitutions with underline and strike styles, not color alone.
- Align the two chains side by side on their shared narrators, using the longest common subsequence of narrator IDs.

Later views (Phase 5):

- **3D:** 3d-force-graph on the same payload, lazy-loaded behind «عرض ثلاثي الأبعاد». It is never the default and is hidden when WebGL is unavailable.
- **Map:** MapLibre GL with a Protomaps PMTiles basemap stored in R2 and served through the Worker. Use a minimal style without modern borders, and animate the journey across each narrator's cited cities.

Rendering budgets: SVG up to 300 nodes, WebGL beyond that. The Web Worker lays out 300 nodes in 200 ms or less, and animation holds 60 fps on a mid-range phone.

## 13. Analytical indicators: research aids, never verdicts

Indicators sit in a panel titled «مؤشرات للباحث». Each one shows its inputs, a one-sentence formula, and its scope: "within Sahih al-Bukhari as loaded here". Use neutral icons and words; no red or green, and no combined score.

| Indicator | Computed from | Shown as |
| --- | --- | --- |
| المعاصرة (contemporaneity) | The student's birth year and the teacher's death year, when both are cited | The overlap in years, or «لا تداخل ظاهر بحسب التواريخ المتاحة» |
| البلد المشترك (shared places) | Both narrators' `narrator_places` | Shared cities with citations, or «لا بلد مشترك مسجّل»; missing data is never evidence |
| صيغة الأداء (transmission phrase) | The link's `term_ar` | The phrase itself: حدثنا، أخبرنا، عن … |
| عنعنة من موصوف بالتدليس (ʿan from a narrator described with tadlis) | `term_ar` is عن and the teacher has a cited `tadlis` flag | Off by default; available in research mode, with the methodology note below |
| طول الإسناد (chain length) | Narrators between al-Bukhari and the Prophet ﷺ | The count; the shortest chains, the ثلاثيات (commonly counted as 22), are labelled |
| المدار (common link) | The shared narrator closest to al-Bukhari through whom every route in the group passes | A ring on the node, or «لا مدار مشترك» |
| عدد الرواة في كل طبقة (narrators per layer) | Distinct narrators at each layer across the group's routes, counted from the source (the Prophet ﷺ is layer 0) | A row of counts, e.g. 1, 1, 1, 1, then many |
| الانقطاع (gaps) | Links of kind `suspended` or `gap`, and unresolved mentions | Broken links in the graph, plus a list |

Scholars discuss how ʿanʿana should be read inside the Sahih. The methodology page must present that discussion from cited sources before the tadlis indicator ships.

## 14. Editorial workflow, security and operations

Staff sign in through Cloudflare Access, and the `staff` table maps each email to a role: editors propose changes, reviewers approve them, admins publish and manage staff.

The editorial flow:

1. The pipeline creates review items: unresolved mentions, low-confidence resolutions, cross-source disagreements, validation warnings and public reports.
2. An editor proposes a fix with a written reason, and a reviewer approves or rejects it.
3. An approved change applies in one D1 batch and writes one `revisions` row per changed field.
4. Publishing bumps the data version, so every cache refreshes.

Admin tools under `/admin`:

- A review queue filtered by item type, book, narrator and confidence.
- A chain editor that shows the isnad text with highlighted mentions beside the ordered links, to reorder links, resolve mentions and set link kinds.
- Narrator merge and split, the main tool for disambiguation errors. A merge keeps every old slug as a redirect.
- A source and citation editor, staff management, and a publish screen with a diff summary.

Security:

- Put `/admin/*` and `/api/v1/admin/*` behind a Cloudflare Access application. On every admin request, the Worker also verifies the `Cf-Access-Jwt-Assertion` JWT against the team's public keys and audience tag, then checks the `staff` role.
- The public report form verifies a Turnstile token on the server, is rate-limited, caps message length, and needs no account.
- Starting rate limits per IP: search 60 per minute, reports 5 per minute, other API calls 300 per minute.
- Use parameterized D1 queries only and zod validation on every input. Send a strict CSP with self-hosted scripts and fonts, `frame-ancestors 'none'`, and HSTS.
- Keep secrets in `wrangler secret put` only. Collect no personal data beyond an optional contact email on reports, and set no tracking cookies.

Operations:

- Enable Workers Logs, with structured JSON lines carrying a request id. Never log report messages or emails.
- Back up with D1 Time Travel plus a weekly `wrangler d1 export` of the core database to R2. The core database has no virtual tables, so it exports; `SEARCH_DB` is rebuilt rather than backed up.
- Run three environments: local (Vite dev server with local D1), preview (its own D1, KV and R2, seeded with fixtures and a sample of real data), and production.

## 15. Performance, SEO and accessibility budgets

CI fails a pull request that breaks any budget below. Measure on the preview deployment, not on localhost.

| Budget | Target |
| --- | --- |
| TTFB, cached hadith page (p75) | under 200 ms |
| TTFB, uncached hadith page (p75) | under 600 ms |
| LCP on a mid-range phone over 4G (p75) | under 2.5 s |
| INP | under 200 ms |
| CLS | under 0.1 |
| Initial JS for a hadith page | 180 KB gzip at most, fonts excluded |
| D1 queries per page render | 3 at most |
| Graph layout for 300 nodes | 200 ms at most, in a Web Worker |

SEO:

- Server-render every hadith, book, chapter and narrator page, with titles such as «صحيح البخاري 1 — إنما الأعمال بالنيات».
- Take the meta description from the opening words of the matn. Emit canonical URLs and `hreflang` for `ar` and `en`.
- Generate a chunked `sitemap.xml` from D1, and a `robots.txt` that blocks `/admin` and `/api`.

Accessibility (WCAG 2.2 AA):

- Every graph has a text equivalent: an ordered list per route and a table of links.
- The graph is keyboard-operable: Tab walks the nodes in chain order, Enter opens a card, Escape closes it.
- Focus is always visible and follows RTL order, and `lang` attributes mark mixed Arabic and English spans.
- Motion respects `prefers-reduced-motion`, and color is never the only signal.

## 16. Testing and the golden fixture

Tests ship with each feature, and CI must be green before the next phase starts.

- **Unit, in TypeScript and Python:** the normalizer and stemmer against the shared vectors file; graph logic (route merging, common link, layer counts, indicators); zod contracts.
- **Worker integration:** Vitest 4.1+ with `@cloudflare/vitest-plugin` and its `cloudflareTest()` plugin, inside the Workers runtime with local D1. The package was called `@cloudflare/vitest-pool-workers` until [August 2026](https://developers.cloudflare.com/changelog/post/2026-08-19-vitest-plugin/), so older examples use that name. Apply migrations in setup with `applyD1Migrations`, seed fixtures, then test endpoints, query counts and cache headers. One test must prove that `WITH RECURSIVE` runs on D1.
- **Pipeline:** pytest, property tests for the normalizer, snapshot tests of parsed chains, and the validation report saved as a CI artifact.
- **End to end:** Playwright against each preview deployment: RTL screenshots on desktop and mobile, journey playback, keyboard navigation, reduced motion, and axe accessibility checks.

The golden fixture is Bukhari no. 1, «إنما الأعمال بالنيات». Parsing its isnad must produce exactly these links. This table is a parser expectation, not content: what the site displays always comes from the loaded source.

| Position | Narrator, as written | Phrase used by the narrator at the previous position |
| --- | --- | --- |
| 0 | البخاري (the compiler, implicit) | — |
| 1 | الحميدي عبد الله بن الزبير | حدثنا |
| 2 | سفيان | حدثنا |
| 3 | يحيى بن سعيد الأنصاري | حدثنا |
| 4 | محمد بن إبراهيم التيمي | أخبرني |
| 5 | علقمة بن وقاص الليثي | سمع (أنه سمع) |
| 6 | عمر بن الخطاب رضي الله عنه | سمعت |
| 7 | رسول الله ﷺ | سمعت |

The fixture also asserts:

- «سفيان» here resolves to Sufyan ibn ʿUyayna, not Sufyan al-Thawri, because al-Humaydi is his known student. This is the resolver's first disambiguation test.
- In the loaded Sahih, every route of this hadith converges on يحيى بن سعيد الأنصاري. The common-link indicator must name him, and the layer counts must be 1 from the Prophet ﷺ down to Yahya, then more than 1.

Add three entries with a suspended link and three with ح, chosen from the loaded source and confirmed by a reviewer, as further fixtures.

## 17. Configuration and deployment

Start from the configuration the React Router scaffold generates, and keep its compatibility flags and asset settings. Then add the bindings below; the IDs are placeholders.

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "isnad-journey",
  "main": "./workers/app.ts",
  "compatibility_date": "<scaffold date>",
  "compatibility_flags": ["nodejs_compat"],
  "observability": { "enabled": true },
  "limits": { "cpu_ms": 5000 },          // cap runaway requests well below the maximum
  "d1_databases": [
    { "binding": "DB", "database_name": "isnad-core", "database_id": "<id>",
      "migrations_dir": "migrations" },
    { "binding": "SEARCH_DB", "database_name": "isnad-search", "database_id": "<id>",
      "migrations_dir": "migrations-search" }
  ],
  "kv_namespaces": [{ "binding": "CONFIG", "id": "<id>" }],
  "r2_buckets": [{ "binding": "DATA", "bucket_name": "isnad-data" }],
  "vectorize": [{ "binding": "MATN_INDEX", "index_name": "isnad-matn-bge-m3" }],
  "ai": { "binding": "AI" },
  "ratelimits": [
    { "name": "SEARCH_LIMITER", "namespace_id": "1001", "simple": { "limit": 60, "period": 60 } },
    { "name": "REPORT_LIMITER", "namespace_id": "1002", "simple": { "limit": 5, "period": 60 } },
    { "name": "API_LIMITER", "namespace_id": "1003", "simple": { "limit": 300, "period": 60 } }
  ],
  "vars": { "ACCESS_TEAM_DOMAIN": "<team>.cloudflareaccess.com", "SITE_URL": "<https://…>" },
  "env": {
    "preview": { /* the same bindings, pointing at preview-only D1, KV, R2 and Vectorize */ }
  }
}
```

Set the secrets `TURNSTILE_SECRET` and `ACCESS_AUD` with `wrangler secret put`. Run `wrangler types` after every binding change, and commit the generated types.

Deployment rules:

- Connect the repository to Workers Builds, or use GitHub Actions with Wrangler. Every pull request gets a preview deployment backed by the preview resources.
- Merging to `main` applies D1 migrations (`wrangler d1 migrations apply DB --remote`, and the same for `SEARCH_DB`) and then deploys.
- Migrations are forward-only and must work with the version still running: expand, migrate, then contract.
- Data publishing is separate from code deploys. It uses the pipeline (section 8), never a migration.

## 18. Delivery phases and acceptance criteria

Phases run in order. Start a phase only when every box of the previous one is ticked, and close each with the report described in section 19.

**Phase 0 — Foundations**

- [ ] Monorepo scaffolded: the React Router app from the Cloudflare scaffold, Hono at `/api/v1`, `packages/shared`, `packages/graph`, and `pipeline/` managed by uv.
- [ ] `wrangler.jsonc` declares `DB`, `SEARCH_DB`, `CONFIG` and `DATA`, and the generated types are committed.
- [ ] Section 7 migrations apply locally and on preview, and the `WITH RECURSIVE` test passes.
- [ ] The RTL shell (`lang="ar" dir="rtl"`), self-hosted fonts, and light and dark tokens are in place.
- [ ] The normalizer and stemmer pass `normalization-cases.json` in both TypeScript and Python.
- [ ] CI runs typecheck, lint and tests in both languages, and deploys previews.
- [ ] Each major decision has an ADR in `docs/adr/`.

**Phase 1 — Data spine for Sahih al-Bukhari**

- [ ] `docs/data-sources.md` evaluates every candidate, and the human has approved it.
- [ ] Every entry of the reference numbering is loaded, with book, chapter, text, isnad, matn and citation.
- [ ] Every entry has parsed routes, with ح splits and suspended links modelled.
- [ ] At least 95% of mentions resolve above the calibrated confidence threshold, and every other mention is in the review queue.
- [ ] Narrator profiles carry names, dates, places and gradings, each with a citation.
- [ ] The golden fixture passes, and the validation report shows zero errors.
- [ ] `SEARCH_DB` is built, and searching «الأعمال بالنيات» returns Bukhari no. 1 among the top five results.
- [ ] The hadith, graph, narrator and search endpoints pass contract tests.

**Phase 2 — Public beta: hadith explorer and isnad journey**

- [ ] Browsing, search and the three-pane hadith page work on desktop, tablet and mobile.
- [ ] Journey mode runs in both directions, with keyboard controls, reduced motion and the text alternative.
- [ ] The isnad text and the graph highlight each other.
- [ ] Narrator cards and profile pages show citations and review badges.
- [ ] The methodology and sources pages are live, with attribution for every CC BY source.
- [ ] The report form works, with Turnstile and rate limiting.
- [ ] Every section 15 budget passes in CI.

**Phase 3 — All routes, narrator network and timeline**

- [ ] Route groups are loaded or curated. The all-routes view shows merged nodes, the common link, divergence points, edge weights and filters.
- [ ] Bukhari no. 1's group converges on Yahya ibn Saʿid al-Ansari, as the fixture asserts.
- [ ] The narrator network expands on click, respects its caps, and lists shared entries.
- [ ] The timeline layout handles undated narrators as specified.
- [ ] The indicators panel shows contemporaneity, shared places, chain length and layer counts.

**Phase 4 — Comparison, semantic search and editorial tools**

- [ ] The compare view diffs matns and aligns chains.
- [ ] Vectorize and hybrid search ship together with the recall@10 report.
- [ ] Semantic suggestions join a group only after a reviewer confirms them.
- [ ] The admin tools work end to end: review queue, chain editor, narrator merge and split, citations, publishing and revisions.
- [ ] The tadlis indicator ships only after its methodology note has been reviewed.
- [ ] The English UI is live.

**Phase 5 — Expansion**

- [ ] An optional 3D view, lazy-loaded and never the default.
- [ ] A map view with PMTiles served from R2.
- [ ] Unnumbered suspended narrations in the chapter headings.
- [ ] Sahih Muslim loads through the same pipeline with no schema changes.

## 19. Working rules and definition of done

Work in phases, report at each gate, and ask before anything irreversible.

1. Before each phase, restate its plan and your assumptions in a few lines, then build in small, reviewable commits.
2. Stop and ask before you approve or swap a data source, change the schema after Phase 1 data is loaded, delete any data, relax a principle from section 3, or add a Cloudflare product, paid service or third-party script not named here.
3. Never fabricate content. When data is missing, leave it missing and say so in the phase report.
4. When a platform limit matters, check the current Cloudflare docs first; the figures in section 4 will drift.
5. Record each decision with real trade-offs in a short ADR.
6. Keep the TypeScript and Python normalizers in lockstep through the shared vectors file.
7. End each phase with a report: what shipped, what did not, data-quality numbers (coverage, resolution rate, open review items) and open questions.

A phase is done when:

- Every acceptance box is ticked and CI is green.
- The preview deployment has been smoke-tested in RTL on desktop and mobile.
- The section 15 budgets pass.
- The README, the methodology page, the ADRs and `docs/data-sources.md` are current.
- No public page shows a fact without a source.

## Sources

All pages were opened on 19 November 2026.

Cloudflare documentation:

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits)
- [D1 SQL statements and supported extensions](https://developers.cloudflare.com/d1/sql-api/sql-statements/)
- [D1 import and export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [D1 global read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/)
- [Vectorize limits](https://developers.cloudflare.com/vectorize/platform/limits)
- [bge-m3 on Workers AI](https://developers.cloudflare.com/workers-ai/models/bge-m3/)
- [React Router framework guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/)
- [Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Vitest integration test APIs](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis)
- [Changelog: the Vitest package rename](https://developers.cloudflare.com/changelog/post/2026-08-19-vitest-plugin/)

Data sources and prior art:

- [Hadith Knowledge Graph «الجامع»](https://huggingface.co/datasets/emadjumaah/hadith-kg)
- [Sanadset 650K](https://data.mendeley.com/datasets/5xth87zwb5)
- [AR-Sanad 280K](https://www.mdpi.com/2078-2489/13/2/55)
- [OpenITI corpus, release 2025.1.9](https://zenodo.org/records/17767721)
- [Sunnah.com developers page](https://sunnah.com/developers) and [Sunnah.com llms.txt](https://sunnah.com/llms.txt)
- [Ilm launch article](https://arriqaaq.com/ilm/articles/launch.html)
