"""Build the core and search databases for Sahih al-Bukhari (SPEC §8 steps 3–8).

    uv run python build.py --raw ../data/raw --out out [--label 2026.11.19-1]

Outputs, all under --out:
    core.sqlite, search.sqlite   the databases, built from apps/web/migrations*
    sql/core-NNN.sql, sql/search-NNN.sql   chunked INSERTs for `wrangler d1 execute`
    validation-report.json       counts, coverage, golden-fixture results; errors fail the run
    review-queue.jsonl           one line per item a human must look at

Never displays or stores an authenticity grade (principle 2): the Hadith-KG
adapter does not read those columns at all.
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from adapters import hadith_kg, tawq
from adapters.hadith_kg import BUKHARI_RAWI_ID
from isnad.chains import MentionIn, Placeholders, build_route
from normalize import analyze, normalize
from resolve.numbering import map_entries, place_in_order

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "apps" / "web" / "migrations"
MIGRATIONS_SEARCH = ROOT / "apps" / "web" / "migrations-search"

KG_VERSION = "2026-07-31"
TAWQ_VERSION = "2025.1.9"
REF_MAX = 7563
PROPHET_ID = 1_000_000  # our own row; Hadith-KG chains end at the Companion
COLLECTION_ID = 1
# Hadith-KG ids that mark a property of the chain, not a person (docs/data-sources.md).
PLACEHOLDERS = Placeholders(
    link_kind={30000: "gap", 30001: "suspended", 30002: "gap"},  # انقطاع، تعليق، إرسال
    unnamed=frozenset({1131}),  # «اسم مبهم»: an unnamed narrator, kept unresolved
)
NOT_PERSONS = set(PLACEHOLDERS.link_kind) | set(PLACEHOLDERS.unnamed)

# Tables in foreign-key order: the order rows are inserted and the reverse of deletion.
CORE_TABLES = [
    "sources", "citations", "narrators", "narrator_names", "narrator_flags", "places", "narrator_places",
    "gradings", "collections", "books", "chapters", "hadith_groups", "hadiths", "hadith_numbers", "chains",
    "chain_links", "transmissions", "data_versions", "review_items",
]  # fmt: skip
SEARCH_TABLES = ["matn_fts", "narrator_fts"]
MAX_STATEMENT_BYTES = 90_000  # D1 allows 100 KB per statement


@dataclass
class Report:
    errors: list[str] = field(default_factory=list)
    warnings: int = 0
    counts: dict[str, int] = field(default_factory=dict)
    coverage: dict[str, object] = field(default_factory=dict)
    golden: dict[str, object] = field(default_factory=dict)


class Review:
    def __init__(self) -> None:
        self.items: list[dict[str, object]] = []

    def add(self, kind: str, **detail: object) -> None:
        self.items.append({"kind": kind, **detail})


def apply_migrations(con: sqlite3.Connection, folder: Path) -> None:
    for f in sorted(folder.glob("*.sql")):
        con.executescript(f.read_text("utf-8"))


class Citations:
    def __init__(self, con: sqlite3.Connection) -> None:
        self.con = con
        self.next_id = 1

    def add(self, source_id: int, locator: str, url: str | None = None) -> int:
        cid = self.next_id
        self.next_id += 1
        self.con.execute(
            "INSERT INTO citations (id, source_id, locator, url) VALUES (?, ?, ?, ?)", (cid, source_id, locator, url)
        )
        return cid


def year_range(raw: str | None, parsed: int | None) -> tuple[int | None, int | None]:
    """Earliest and latest year when the source string gives a range, else (parsed, None)."""
    if parsed is not None:
        return parsed, None
    nums = [int(n) for n in re.findall(r"\d+", raw or "")]
    if len(nums) >= 2:
        return min(nums), max(nums)
    return None, None


def build(raw: Path, out: Path, label: str) -> Report:
    out.mkdir(parents=True, exist_ok=True)
    report, review = Report(), Review()
    for f in ("core.sqlite", "search.sqlite"):
        (out / f).unlink(missing_ok=True)
    con = sqlite3.connect(out / "core.sqlite")
    con.execute("PRAGMA foreign_keys = ON")
    apply_migrations(con, MIGRATIONS)
    cites = Citations(con)
    retrieved = {
        "kg": (raw / "hadith-kg" / KG_VERSION / "RETRIEVED_AT").read_text().strip(),
        "tawq": (raw / "openiti-bukhari" / TAWQ_VERSION / "RETRIEVED_AT").read_text().strip(),
    }

    # --- Sources -------------------------------------------------------------
    KG_SRC, TAWQ_SRC = 1, 2
    con.execute(
        "INSERT INTO sources (id, slug, kind, title_ar, title_en, author_ar, edition, url, license, attribution, retrieved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (KG_SRC, hadith_kg.SOURCE_SLUG, "dataset", "الجامع — قاعدة معرفة الحديث", "Hadith Knowledge Graph «al-Jamiʿ»", None,
         f"hadith-kg.db, {KG_VERSION}", "https://huggingface.co/datasets/emadjumaah/hadith-kg", "CC-BY-4.0",
         "Hadith Knowledge Graph «الجامع» by Emad Jumaah, CC BY 4.0, huggingface.co/datasets/emadjumaah/hadith-kg",
         retrieved["kg"]),
    )  # fmt: skip
    con.execute(
        "INSERT INTO sources (id, slug, kind, title_ar, title_en, author_ar, edition, url, license, attribution, retrieved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (TAWQ_SRC, tawq.SOURCE_SLUG, "primary_text", "صحيح البخاري (الجامع المسند الصحيح المختصر)", "Sahih al-Bukhari",
         "محمد بن إسماعيل البخاري",
         "دار طوق النجاة، الطبعة الأولى 1422هـ، تحقيق محمد زهير بن ناصر الناصر، بترقيم محمد فؤاد عبد الباقي؛ "
         f"نسخة OpenITI {tawq.FILE_NAME} (الإصدار {TAWQ_VERSION})",
         "https://github.com/OpenITI/0275AH/tree/master/data/0256Bukhari/0256Bukhari.Sahih", "CC-BY-NC-SA-4.0",
         f"OpenITI corpus, release {TAWQ_VERSION} (zenodo.org/records/17767721), CC BY-NC-SA 4.0",
         retrieved["tawq"]),
    )  # fmt: skip

    # --- Read sources --------------------------------------------------------
    reference = tawq.parse(raw / "openiti-bukhari" / TAWQ_VERSION / tawq.FILE_NAME)
    kgcon = hadith_kg.connect(raw / "hadith-kg" / KG_VERSION / "hadith-kg.db")
    kg_entries = sorted(hadith_kg.load_entries(kgcon), key=lambda e: e.no_inbook)
    ref_text = {n: e.text for n, e in reference.entries.items()}
    mapping = map_entries(ref_text, [(e.id, e.nass, e.matn_start) for e in kg_entries])
    placed, unmapped = place_in_order(mapping, [(e.id, e.nass) for e in kg_entries], ref_text, REF_MAX)
    for kid, why in unmapped.items():
        e = next(x for x in kg_entries if x.id == kid)
        review.add("unplaced_kg_entry", kg_hadith_id=kid, kg_no=e.no_inbook, reason=why)
    kg_by_ref = {p.ref: next(x for x in kg_entries if x.id == p.kg_id) for p in placed.values()}
    for p in placed.values():
        if p.method == "order":
            review.add("numbering_by_order_only", ref=p.ref, kg_hadith_id=p.kg_id)

    # --- Narrators -----------------------------------------------------------
    chain_ids = (
        {r for e in kg_by_ref.values() for c in e.chains for r in c.rawi_ids} | {BUKHARI_RAWI_ID}
    ) - NOT_PERSONS
    rawis = hadith_kg.load_rawis(kgcon, chain_ids)
    missing_rawis = chain_ids - set(rawis)
    if missing_rawis:
        report.errors.append(f"{len(missing_rawis)} chain narrators have no rawis row")
    place_ids: dict[str, int] = {}
    for r in rawis.values():
        role = (
            "compiler"
            if r.id == BUKHARI_RAWI_ID
            else ("companion" if (r.rank or "").startswith("صحابي") else "narrator")
        )
        dcite = cites.add(KG_SRC, f"rawis.id={r.id}")
        death, death_max = year_range(r.death_year_raw, r.death_year)
        birth, _ = year_range(r.birth_year_raw, r.birth_year)
        con.execute(
            "INSERT INTO narrators (id, slug, display_name_ar, full_name_ar, role, tabaqa, birth_ah, death_ah, "
            "death_ah_max, dates_citation_id, summary_grade_ar, summary_grade_citation_id, review_status) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL,'auto')",
            # summary_grade_ar keeps Hadith-KG's unattributed one-line grade with NO citation:
            # the API shows a summary grade only when it has a citation (decision 3).
            (r.id, f"r{r.id}", r.nickname, r.name, role, r.tabaka, birth, death, death_max, dcite, r.rank),
        )
        names = {(r.nickname, "short"), (r.name, "full")}
        for form, kind in names:
            if form:
                con.execute(
                    "INSERT OR IGNORE INTO narrator_names VALUES (?,?,?,?)", (r.id, form, normalize(form), kind)
                )
        for flag, on in (("tadlis", r.has_tadlis), ("ikhtilat", r.has_ikhtilat)):
            if on:
                con.execute(
                    "INSERT INTO narrator_flags VALUES (?,?,NULL,?)",
                    (r.id, flag, cites.add(KG_SRC, f"rawis.id={r.id} has_{flag}")),
                )
        for rel, raw_places in (("lived", r.iqama), ("died", r.death_place)):
            for name in {p.strip() for p in re.split(r"[،,]", raw_places or "") if p.strip()}:
                if name not in place_ids:
                    place_ids[name] = len(place_ids) + 1
                    con.execute("INSERT INTO places (id, name_ar) VALUES (?, ?)", (place_ids[name], name))
                con.execute(
                    "INSERT OR IGNORE INTO narrator_places VALUES (?,?,?,?)",
                    (r.id, place_ids[name], rel, cites.add(KG_SRC, f"rawis.id={r.id} {'iqama' if rel == 'lived' else 'death_place'}")),
                )  # fmt: skip
    con.execute(
        "INSERT INTO narrators (id, slug, display_name_ar, role, honorific_ar, review_status) "
        "VALUES (?, 'al-nabi', 'رسول الله', 'prophet', ?, 'auto')",
        (PROPHET_ID, chr(0xFDFA)),  # principle 8: ﷺ after the Prophet's name
    )
    for q in hadith_kg.load_aqwal(kgcon, set(rawis)):
        con.execute(
            "INSERT INTO gradings (narrator_id, critic_name_ar, statement_ar, citation_id) VALUES (?,?,?,?)",
            (q.rawi_id, q.critic, q.text.strip(), cites.add(KG_SRC, f"aqwal.id={q.id}")),
        )

    # --- Collection, books, chapters -------------------------------------------
    con.execute(
        "INSERT INTO collections VALUES (?, 'bukhari', 'صحيح البخاري', 'Sahih al-Bukhari', ?)",
        (COLLECTION_ID, BUKHARI_RAWI_ID),
    )
    chapter_id: dict[tuple[int, int], int] = {}
    for k in reference.kitabs:
        con.execute(
            "INSERT INTO books (id, collection_id, number, title_ar) VALUES (?,?,?,?)",
            (k.number, COLLECTION_ID, k.number, k.title),
        )
        for b in k.babs:
            cid = len(chapter_id) + 1
            chapter_id[(k.number, b.seq)] = cid
            con.execute(
                "INSERT INTO chapters (id, book_id, number, title_ar) VALUES (?,?,?,?)", (cid, k.number, b.seq, b.title)
            )

    # A number absent from the reference text lies in the same كتاب (or باب) as both
    # its nearest present neighbours whenever those agree: numbering runs through the book.
    present = sorted(reference.entries)

    def locate(n: int) -> tuple[int | None, int | None]:
        if n in reference.entries:
            e = reference.entries[n]
            return e.kitab, e.bab_seq
        import bisect

        i = bisect.bisect_left(present, n)
        if i == 0 or i == len(present):
            return None, None
        lo, hi = reference.entries[present[i - 1]], reference.entries[present[i]]
        if lo.kitab != hi.kitab:
            return None, None
        return lo.kitab, (lo.bab_seq if lo.bab_seq == hi.bab_seq else None)

    # --- Groups, hadiths, numbers ----------------------------------------------
    groups = sorted({e.group_id for e in kg_by_ref.values() if e.group_id is not None})
    con.executemany(
        "INSERT INTO hadith_groups (id, method, review_status) VALUES (?, 'dataset', 'auto')", [(g,) for g in groups]
    )
    in_book_counter: dict[int, int] = defaultdict(int)
    no_chapter = 0
    for n in range(1, REF_MAX + 1):
        kg_e = kg_by_ref.get(n)
        tq = reference.entries.get(n)
        if kg_e is None and tq is None:
            review.add("number_missing_from_all_sources", ref=n)
            continue
        kitab, bab = locate(n)
        ch = chapter_id.get((kitab, bab)) if kitab and bab else None
        if ch is None:
            no_chapter += 1
        if kg_e is not None:
            text, ms, me = kg_e.nass, kg_e.matn_start, kg_e.matn_end
            isnad = text[:ms] if ms is not None else None
            matn = text[ms:me] if ms is not None else None
            cite = cites.add(KG_SRC, f"hadiths.id={kg_e.id} (no_inbook {kg_e.no_inbook})")
            group = kg_e.group_id
        else:
            assert tq is not None
            text, isnad, matn = tq.text, None, None
            cite = cites.add(TAWQ_SRC, f"رقم {n}")
            group = None
        con.execute(
            "INSERT INTO hadiths (id, collection_id, chapter_id, ref_number, text_ar, isnad_ar, matn_ar, group_id, "
            "citation_id, review_status) VALUES (?,?,?,?,?,?,?,?,?,'auto')",
            (n, COLLECTION_ID, ch, n, text, isnad, matn, group, cite),
        )
        if kitab:
            in_book_counter[kitab] += 1
            con.execute("INSERT INTO hadith_numbers VALUES (?, 'in-book', ?)", (n, f"{kitab}:{in_book_counter[kitab]}"))
        if kg_e is not None:
            con.execute("INSERT INTO hadith_numbers VALUES (?, 'hadith-kg', ?)", (n, str(kg_e.no_inbook)))

    # --- Chains ------------------------------------------------------------------
    chain_no = 0
    route_warnings = 0
    marfu_ending_at_companion = 0
    for n, e in sorted(kg_by_ref.items()):
        isnad_end = e.matn_start if e.matn_start is not None else len(e.nass)
        mentions = [MentionIn(m.rawi_id, m.start, m.end) for m in e.mentions]
        marfu = e.type_no in (0, 1)
        for route_no, c in enumerate(e.chains, start=1):
            r = build_route(e.nass, isnad_end, c.rawi_ids, mentions, BUKHARI_RAWI_ID, PROPHET_ID, marfu, PLACEHOLDERS)
            for w in r.warnings:
                if w.startswith("marfu entry"):
                    # Reported about the Prophet ﷺ without naming him as the source (e.g.
                    # «أنه كان يصلي بهم»): the chain as written ends at the Companion. Not a defect.
                    marfu_ending_at_companion += 1
                    continue
                route_warnings += 1
                review.add("chain_warning", ref=n, route=route_no, kg_sanad_id=c.sanad_id, detail=w)
            last = r.links[-1].narrator_id
            if r.ends_with_prophet:
                terminus = "prophet"
            elif last is not None and last in rawis and (rawis[last].rank or "").startswith("صحابي"):
                terminus = "companion"
            elif last is not None and last in rawis and rawis[last].tabaka is not None and rawis[last].tabaka <= 4:
                terminus = "successor"
            else:
                terminus = "other"
            chain_no += 1
            con.execute(
                "INSERT INTO chains VALUES (?,?,?,?,?,?, 'auto')",
                (chain_no, n, route_no, terminus, int(r.is_suspended), cites.add(KG_SRC, f"sanads.id={c.sanad_id}")),
            )
            for lk in r.links:
                con.execute(
                    "INSERT INTO chain_links VALUES (?,?,?,?,?,?,?,?,?,NULL)",
                    (chain_no, lk.position, lk.narrator_id, lk.mention_ar or "",  # "" = implied, not written here
                     lk.mention_start, lk.mention_end, lk.term_ar, lk.link_kind, lk.resolution),
                )  # fmt: skip
    # Mention forms as written become searchable name forms.
    for nid, form in con.execute(
        "SELECT DISTINCT narrator_id, mention_ar FROM chain_links WHERE position > 0"
    ).fetchall():
        if nid is not None and form and nid != PROPHET_ID:
            con.execute("INSERT OR IGNORE INTO narrator_names VALUES (?,?,?,'short')", (nid, form, normalize(form)))

    # --- Derived: transmissions --------------------------------------------------
    con.execute(
        "INSERT INTO transmissions (teacher_id, student_id, hadith_count) "
        "SELECT t.narrator_id, s.narrator_id, COUNT(DISTINCT c.hadith_id) FROM chain_links s "
        "JOIN chain_links t ON t.chain_id = s.chain_id AND t.position = s.position + 1 "
        "JOIN chains c ON c.id = s.chain_id "
        "WHERE s.narrator_id IS NOT NULL AND t.narrator_id IS NOT NULL AND t.narrator_id != s.narrator_id "
        "GROUP BY t.narrator_id, s.narrator_id"
    )
    con.execute("INSERT INTO data_versions (label, published_at, notes) VALUES (?, ?, ?)",
                (label, datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"), "Phase 1 build from Hadith-KG + OpenITI Tawq al-Najat"))  # fmt: skip
    con.commit()

    # --- Validate (SPEC §8 step 5) -----------------------------------------------------
    validate(con, report)
    report.warnings = route_warnings
    report.counts = {
        t: con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in CORE_TABLES if t != "review_items"
    }
    total_mentions, resolved = con.execute(
        "SELECT COUNT(*), SUM(narrator_id IS NOT NULL) FROM chain_links WHERE position > 0 AND mention_start IS NOT NULL"
    ).fetchone()
    kg_mentions = sum(len(e.mentions) for e in kg_by_ref.values())
    kg_resolved = sum(
        1 for e in kg_by_ref.values() for m in e.mentions if (m.rawi_id is not None and m.rawi_id in rawis) or False
    )
    report.coverage = {
        "reference_numbers": REF_MAX,
        "entries_loaded": report.counts["hadiths"],
        "entries_with_kg_chain": len(kg_by_ref),
        "entries_text_only": report.counts["hadiths"] - len(kg_by_ref),
        "numbers_missing_from_all_sources": REF_MAX - report.counts["hadiths"],
        "placement_methods": {
            m: sum(1 for p in placed.values() if p.method == m) for m in ("text", "order+text", "order")
        },
        "kg_entries_unplaced": len(unmapped),
        "entries_without_chapter": no_chapter,
        "chain_link_mentions": total_mentions,
        "chain_link_mentions_resolved": resolved,
        "links_implied_not_written": con.execute(
            "SELECT COUNT(*) FROM chain_links WHERE position > 0 AND mention_start IS NULL"
        ).fetchone()[0],
        "marfu_routes_ending_at_companion_as_written": marfu_ending_at_companion,
        "links_by_kind": dict(con.execute("SELECT link_kind, COUNT(*) FROM chain_links GROUP BY link_kind").fetchall()),
        "suspended_chains": con.execute("SELECT COUNT(*) FROM chains WHERE is_suspended = 1").fetchone()[0],
        "unresolved_links": con.execute("SELECT COUNT(*) FROM chain_links WHERE resolution = 'unresolved'").fetchone()[
            0
        ],
        "text_mentions_in_loaded_kg_entries": kg_mentions,
        "text_mentions_resolved_to_loaded_narrators": kg_resolved,
    }
    report.golden = golden(con)
    if not all(v is True for k, v in report.golden.items() if k.startswith("ok_")):
        report.errors.append("golden fixture failed")

    # --- Search database ---------------------------------------------------------
    scon = sqlite3.connect(out / "search.sqlite")
    apply_migrations(scon, MIGRATIONS_SEARCH)
    for hid, text, matn in con.execute("SELECT id, text_ar, matn_ar FROM hadiths"):
        surface, stem = analyze(matn or text)
        scon.execute("INSERT INTO matn_fts VALUES (?, 'bukhari', ?, ?)", (hid, " ".join(surface), " ".join(stem)))
    names: dict[int, set[str]] = defaultdict(set)
    for nid, form in con.execute("SELECT narrator_id, form_ar FROM narrator_names"):
        names[nid].add(form)
    for nid, forms in names.items():
        surface, stem = analyze(" ".join(sorted(forms)))
        scon.execute("INSERT INTO narrator_fts VALUES (?, ?, ?)", (nid, " ".join(surface), " ".join(stem)))
    scon.commit()

    # --- Emit SQL ------------------------------------------------------------------
    sql_dir = out / "sql"
    sql_dir.mkdir(exist_ok=True)
    for f in sql_dir.glob("*.sql"):
        f.unlink()
    emit(con, [t for t in CORE_TABLES if t != "review_items"], sql_dir, "core")
    emit(scon, SEARCH_TABLES, sql_dir, "search")

    # Companions' honorifics are set in review, never by string matching (principle 8).
    for (nid,) in con.execute("SELECT id FROM narrators WHERE role = 'companion' AND honorific_ar IS NULL ORDER BY id"):
        review.add("honorific_missing", narrator_id=nid)
    # The review queue goes into the database for the editorial tools (SPEC §14).
    entity_of = {"kg_hadith_id": None, "ref": "hadith", "narrator_id": "narrator"}
    for item in review.items:
        ent = next(((entity_of[k], item[k]) for k in ("ref", "narrator_id") if k in item), (None, None))
        detail = {k: v for k, v in item.items() if k != "kind"}
        con.execute(
            "INSERT INTO review_items (kind, entity, entity_id, detail) VALUES (?, ?, ?, ?)",
            (item["kind"], ent[0], ent[1], json.dumps(detail, ensure_ascii=False)),
        )
    con.commit()
    emit(con, ["review_items"], sql_dir, "review")
    report.counts["review_items"] = len(review.items)

    (out / "validation-report.json").write_text(json.dumps(report.__dict__, ensure_ascii=False, indent=2), "utf-8")
    with (out / "review-queue.jsonl").open("w", encoding="utf-8") as f:
        for item in review.items:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")
    report.coverage["review_items"] = len(review.items)
    return report


def validate(con: sqlite3.Connection, report: Report) -> None:
    def err(sql: str, msg: str) -> None:
        n = con.execute(sql).fetchone()[0]
        if n:
            report.errors.append(f"{n} {msg}")

    err("SELECT COUNT(*) FROM (SELECT chain_id FROM chain_links GROUP BY chain_id HAVING MAX(position) + 1 != COUNT(*))",
        "chains with non-contiguous positions")  # fmt: skip
    err("SELECT COUNT(*) FROM chains c WHERE NOT EXISTS (SELECT 1 FROM chain_links l WHERE l.chain_id = c.id AND l.position = 0 "
        f"AND l.narrator_id = {BUKHARI_RAWI_ID})", "chains not starting with the compiler")  # fmt: skip
    err(
        "SELECT COUNT(*) FROM chain_links WHERE position = 0 AND mention_start IS NOT NULL",
        "compiler links with offsets",
    )
    err("SELECT COUNT(*) FROM chain_links l JOIN hadiths h ON h.id = (SELECT hadith_id FROM chains WHERE id = l.chain_id) "
        "WHERE l.mention_start IS NOT NULL AND substr(h.text_ar, l.mention_start + 1, l.mention_end - l.mention_start) != l.mention_ar",
        "mentions whose offsets do not reproduce the text")  # fmt: skip
    err("SELECT COUNT(*) FROM chains c WHERE is_suspended = 1 AND NOT EXISTS "
        "(SELECT 1 FROM chain_links l WHERE l.chain_id = c.id AND l.position = 1 AND l.link_kind = 'suspended')",
        "suspended chains without a suspended first link")  # fmt: skip
    err("SELECT COUNT(*) FROM narrators WHERE death_ah IS NOT NULL AND (death_ah < 0 OR death_ah > 300)",
        "narrator death years outside 0–300 AH")  # fmt: skip
    err("SELECT COUNT(*) FROM narrators WHERE birth_ah IS NOT NULL AND death_ah IS NOT NULL AND birth_ah > death_ah",
        "narrators born after their death year")  # fmt: skip
    fk = con.execute("PRAGMA foreign_key_check").fetchall()
    if fk:
        report.errors.append(f"{len(fk)} foreign-key violations")


def golden(con: sqlite3.Connection) -> dict[str, object]:
    """SPEC §16 golden fixture on the built data."""
    rows = con.execute(
        "SELECT l.position, l.narrator_id, l.term_ar, n.display_name_ar FROM chains c JOIN chain_links l ON l.chain_id = c.id "
        "LEFT JOIN narrators n ON n.id = l.narrator_id WHERE c.hadith_id = 1 AND c.route_no = 1 ORDER BY l.position"
    ).fetchall()
    terms = [r[2] for r in rows]
    names = [r[3] for r in rows]
    # Common link across every Bukhari route in no. 1's group: the shared narrator nearest al-Bukhari.
    chains = con.execute(
        "SELECT c.id FROM chains c JOIN hadiths h ON h.id = c.hadith_id WHERE h.group_id = (SELECT group_id FROM hadiths WHERE id = 1)"
    ).fetchall()
    sets, depth = [], {}
    for (cid,) in chains:
        links = con.execute(
            "SELECT position, narrator_id FROM chain_links WHERE chain_id = ? ORDER BY position", (cid,)
        ).fetchall()
        sets.append({nid for _, nid in links if nid is not None})
        for pos, nid in links:
            depth[nid] = min(depth.get(nid, 99), pos)
    common = set.intersection(*sets) - {BUKHARI_RAWI_ID} if sets else set()
    madar = min(common, key=lambda n: depth[n]) if common else None
    madar_name = (
        con.execute("SELECT display_name_ar FROM narrators WHERE id = ?", (madar,)).fetchone() if madar else None
    )
    return {
        "chain_names": names,
        "chain_terms": terms,
        "ok_positions": len(rows) == 8,
        "ok_terms": terms == [None, "حدثنا", "حدثنا", "حدثنا", "أخبرني", "أنه سمع", "سمعت", "سمعت"],
        "ok_sufyan_is_ibn_uyayna": len(names) > 2 and names[2] == "سفيان بن عيينة الهلالي",
        "ok_ends_with_prophet": bool(rows) and rows[-1][1] == PROPHET_ID,
        "group_routes": len(chains),
        "common_link": madar_name[0] if madar_name else None,
        "ok_common_link_is_yahya": bool(madar_name) and madar_name[0] == "يحيى بن سعيد الأنصاري",
    }


def emit(con: sqlite3.Connection, tables: list[str], folder: Path, prefix: str) -> None:
    """Chunked multi-row INSERTs, each statement under MAX_STATEMENT_BYTES, files of ~4 MB."""
    file_no, size, buf = 1, 0, []

    def flush() -> None:
        nonlocal file_no, size, buf
        if buf:
            (folder / f"{prefix}-{file_no:03d}.sql").write_text("".join(buf), "utf-8")
            file_no, size, buf = file_no + 1, 0, []

    for t in tables:
        cols = [r[1] for r in con.execute(f"PRAGMA table_info({t})")]
        quoted = " || ',' || ".join(f'quote("{c}")' for c in cols)
        head = f"INSERT INTO {t} ({', '.join(cols)}) VALUES "
        stmt: list[str] = []
        stmt_bytes = len(head)
        for (values,) in con.execute(f"SELECT '(' || {quoted} || ')' FROM {t}"):
            b = len(values.encode("utf-8")) + 1
            if stmt and stmt_bytes + b > MAX_STATEMENT_BYTES:
                buf.append(head + ",".join(stmt) + ";\n")
                size += stmt_bytes
                stmt, stmt_bytes = [], len(head)
                if size > 4_000_000:
                    flush()
            stmt.append(values)
            stmt_bytes += b
        if stmt:
            buf.append(head + ",".join(stmt) + ";\n")
            size += stmt_bytes
    flush()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--raw", type=Path, default=ROOT / "data" / "raw")
    ap.add_argument("--out", type=Path, default=Path(__file__).resolve().parent / "out")
    ap.add_argument("--label", default=datetime.now(UTC).strftime("%Y.%m.%d-1"))
    args = ap.parse_args()
    report = build(args.raw, args.out, args.label)
    print(
        json.dumps(
            {"errors": report.errors, "coverage": report.coverage, "golden": report.golden},
            ensure_ascii=False,
            indent=2,
        )
    )
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
