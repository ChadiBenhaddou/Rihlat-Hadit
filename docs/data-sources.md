# Data sources: evaluation for Sahih al-Bukhari

**Status:** approved by the project owner on 2026-11-19 (SPEC §8 step 2). Decisions are recorded at the end.
**Evaluated:** 2026-11-19. Raw copies, with SHA-256 checksums and retrieval dates, are under `data/raw/<source>/<version>/` (git-ignored; they go to R2 under `raw/` once the account exists).

## Summary

No single source meets the spec on its own. The recommendation is to combine two, and to use a third only for cross-checking:

| Role | Source | Licence | Why |
| --- | --- | --- | --- |
| Chains, narrators, mention offsets, route groups | **Hadith-KG «الجامع»** | CC BY 4.0 | Chains already resolved to narrator IDs; it passes every golden-fixture check |
| Reference numbering 1–7,563 and the كتاب/باب structure | **OpenITI: Tawq al-Najat text** (`Shamela0001681`) | CC BY-NC-SA 4.0 | The only candidate with al-Bukhari's chapter titles and the reference numbering |
| Cross-check of chains | **Sanadset 650K** | CC BY 4.0 | Independent extraction from the text; names only, no IDs |

Two candidates are **not** recommended for ingestion: AR-Sanad (no licence stated) and the sunnah.com API (needs a key and permission). Both are discussed below.

Four decisions are yours, listed at the end. They concern provenance, the non-commercial licence, gradings, and which text to display.

## Hadith-KG «الجامع»

- **Where:** [huggingface.co/datasets/emadjumaah/hadith-kg](https://huggingface.co/datasets/emadjumaah/hadith-kg), file `hadith-kg.db` (1,634,877,440 bytes, sha256 `d5280843…815a6`), last modified 2026-07-31. Code: [github.com/emadjumaah/hadith](https://github.com/emadjumaah/hadith) (MIT).
- **Licence:** CC BY 4.0. Attribution required.
- **Provenance:** the database's `meta.source` reads «mongodump hadithdb/hadith (2017-10-12) + rawa_cat.csv». **The upstream site or database is not named anywhere**, and the raw dump is not distributed. The edition it gives for Bukhari is «بيروت، دار ابن كثير، اليمامة، الطبعة الثالثة» (al-Bugha's edition).

### Bukhari coverage (measured)

| Measure | Value |
| --- | --- |
| Bukhari entries (`books.id = 1`) | **7,031** (reference numbering: 7,563) |
| Its numbering | 1–7,031, contiguous. **Its own sequence, not the reference numbering, and not even book order** (its no. 3000 is reference no. 3221) |
| Entries by type | مرفوع 6,412 · قدسي 121 · موقوف 498 |
| Entries with at least one chain | 6,533. **None of the 498 موقوف entries has a chain** |
| Chains (routes) | 8,795; 3 to 10 links each, 6.2 on average |
| Chain links resolved to a narrator ID | 54,456 of 54,456 (100%); 0 stub narrators; 1,634 distinct narrators |
| Narrator mentions in the text, with character offsets | 41,697; **52 unresolved** (0.12%) and 2 pointing to a missing narrator |
| Entries whose isnad/matn boundary is marked | 7,031 of 7,031 |
| Entries in a route group (`group_id`) | 6,533 |

**Mapping to the reference numbering.** A first pass that matches word 4-grams against the Tawq al-Najat text maps **5,596 of 7,031 entries (80%)** to a reference number with confidence; 12 of those collide. The other 1,435 are ambiguous, mostly al-Bukhari's own repetitions of the same matn. The pipeline must separate them using the chain as well as the text. The roughly 530 reference numbers with no KG entry will come from the Tawq al-Najat text, with chains parsed by our own parser and unresolved mentions queued for review.

### Golden fixture (SPEC §16), checked against the data

| Check | Result |
| --- | --- |
| Hadith no. 1 chain, positions 0–6 | ✅ البخاري ← الحميدي ← سفيان ← يحيى بن سعيد الأنصاري ← محمد بن إبراهيم التيمي ← علقمة بن وقاص ← عمر بن الخطاب |
| Position 7 (the Prophet ﷺ) | ⚠️ Not stored as a link: KG chains end at the Companion. Our loader adds it for مرفوع entries |
| «سفيان» resolves to Sufyan ibn ʿUyayna | ✅ narrator 3443 «سفيان بن عيينة الهلالي» |
| Every Bukhari route of the hadith converges on Yahya ibn Saʿid | ✅ 7 routes in group 319; the shared narrator nearest al-Bukhari is Yahya ibn Saʿid al-Ansari |
| Transmission phrases (حدثنا، أخبرني، سمعت) | ⚠️ Not stored. They are recoverable from the text between the mention offsets |

### Gaps against the spec

- **No كتاب/باب structure.** There are no chapter tables at all; this comes from the Tawq al-Najat text instead.
- **No transmission phrases, no ح markers and no معلق flags.** Our parser derives all three from the text.
- **Narrator fields lack citations.** Dates (`death_year_raw` keeps the source string), places (`iqama`), tabaqa, tadlis/ikhtilat flags and the one-line `rank` carry no work or page. Under SPEC §8 they display as «مصدر ثانوي» until a reviewer adds a primary citation.
- **Critics' statements (`aqwal`: 127,863) are attributed to named critics but cite no work or page.** Same treatment: «مصدر ثانوي».
- **⚠️ It contains automatic authenticity grades.** `hadiths.matn`, `sanads.matn`, `sanads.hukum`, `sanads.max_rank`, `meaning_groups.matn_no` and `tarafs.matn` label 990 Bukhari entries حسن, 44 ضعيف and 4 شديد الضعف. **Principle 2 forbids showing or computing verdicts**, so the loader must drop every one of these fields. They are never stored in D1.
- `meaning_groups.sahaba_qty` and `repeat_qty` are stale, by the dataset's own note. We recompute them from the chains.

## OpenITI: Sahih al-Bukhari texts

- **Where:** the `OpenITI/0275AH` repository, `data/0256Bukhari/0256Bukhari.Sahih/`. Corpus release [2025.1.9 on Zenodo](https://zenodo.org/records/17767721).
- **Licence:** CC BY-NC-SA 4.0 for the corpus: **non-commercial, share-alike**.
- Two versions were evaluated:

| | `JK000110` | `Shamela0001681` |
| --- | --- | --- |
| Edition | al-Bugha, دار ابن كثير، ط3، 1407/1987 | Dar Tawq al-Najat, ed. Muhammad Zuhayr al-Nasir, ط1 1422 (the Sultaniyya with Muhammad Fuad Abd al-Baqi's numbering) |
| Numbering | 1–7,124 (the digital version's own) | **Reference numbering, up to 7,563.** A naive parse finds 7,359; the rest need closer rules |
| كتاب / باب | ✅ clearly marked (`### \|` / `### \|\|`); 100 كتاب headings, 3,596 باب | ✅ present, but one heading level for both; needs heuristics |
| Tashkeel | none | none |
| Golden fixture text of no. 1 | ✅ matches | ✅ matches |

**Recommendation:** use `Shamela0001681` for the reference numbering and the chapter titles. Use `JK000110` to help label كتاب versus باب where the Tawq al-Najat markup is ambiguous; both editions share al-Bukhari's own chapter titles.

## Sanadset 650K

- **Where:** [Mendeley Data 5xth87zwb5](https://data.mendeley.com/datasets/5xth87zwb5), version 5 (2022-11-02); `sanadset.csv` is 1.43 GB.
- **Licence:** CC BY 4.0.
- **Bukhari rows:** 6,977, with its own numbering (its no. 4134 is not reference 4134). Each row has the full text with `<NAR>` tags, the matn, and the chain as a list of name strings. **There are no narrator IDs.**
- **Use:** cross-check only (SPEC §8 step 6). Compare chain length and mention strings per route, and queue each disagreement.

## Not recommended for ingestion

- **AR-Sanad 280K:** no licence is stated. It could help evaluate the resolver later, but only after the authors grant permission. Contacting them is yours to decide.
- **Sunnah.com API:** needs an API key and permission. The site's numbering matches the Tawq al-Najat reference numbering we will already have. Recommendation: link out to sunnah.com by number, and don't ingest.

## Decisions needed before Phase 1 continues

1. **Hadith-KG's unnamed upstream.** The licence is clear, but the 2017 «hadithdb» dump behind it is not identified. Approve it as a **secondary source**, with every fact from it labelled «مصدر ثانوي» until reviewed? Or should I first try to identify the upstream (for example by asking the maintainer)?
2. **OpenITI's non-commercial licence.** Taking the numbering and chapter titles from OpenITI makes that layer **CC BY-NC-SA**: no commercial use, and derivative data must be shared under the same licence. Is the project non-commercial? If not, the chapter structure needs another source.
3. **Gradings.** I will drop all of Hadith-KG's hadith and chain authenticity grades, as principle 2 requires. For narrators, its critics' statements are attributed to named critics but uncited. Show them with «مصدر ثانوي», or hold them back until reviewed? The unattributed one-line `rank` (it reads like Ibn Hajar's *Taqrib*, but the dataset never says so) I recommend **holding back** until a reviewer attributes it.
4. **Which text to display.** Hadith-KG's text has full tashkeel but an unnamed source; the Tawq al-Najat text is identified but has no tashkeel. Principle 9 asks for the tashkeel of the source. Recommendation: display the Hadith-KG text, cited as «مصدر ثانوي», for the entries it covers, and the Tawq al-Najat text for the rest, marked as without tashkeel.

## Decisions (approved 2026-11-19)

1. **Hadith-KG is approved as a secondary source.** Every fact that rests on it is labelled «مصدر ثانوي» until a reviewer adds a primary citation.
2. **The project is non-commercial.** OpenITI (CC BY-NC-SA 4.0) supplies the reference numbering and the كتاب/باب titles, with attribution. Data derived from it is shared under the same licence.
3. **Gradings:** named critics' statements are shown, labelled «مصدر ثانوي». The unattributed one-line `rank` is stored but **not displayed** until a reviewer attributes it. All hadith and chain authenticity grades are dropped at load and never stored.
4. **Display text:** the Hadith-KG text, with tashkeel, cited as «مصدر ثانوي». Reference numbers with no KG entry display the Tawq al-Najat text, marked as without tashkeel.
