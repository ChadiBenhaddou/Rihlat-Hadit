"""Adapter: Hadith-KG «الجامع» (CC BY 4.0), Sahih al-Bukhari subset.

Approved as a secondary source (docs/data-sources.md). Principle 2 forbids
automatic verdicts, so this adapter never selects the grade columns
(hadiths.matn/matn_no, sanads.matn/hukum/max_rank, meaning_groups.matn_no,
tarafs.matn). tests/test_hadith_kg.py checks that.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from pathlib import Path

SOURCE_SLUG = "hadith-kg"
BUKHARI_BOOK_ID = 1
BUKHARI_RAWI_ID = 6817  # rawis.id of al-Bukhari, position 0 of his chains

# Columns this adapter may read. Grade columns are deliberately absent.
SELECTED_COLUMNS: dict[str, tuple[str, ...]] = {
    "hadiths": ("id", "no_inbook", "type_no", "group_id", "nass", "matn_start", "matn_end"),
    "sanads": ("id", "hadith_id"),
    "sanad_rawis": ("sanad_id", "pos", "rawi_id"),
    "hadith_rawis": ("hadith_id", "seq", "rawi_id", "start", "end"),
    "rawis": (
        "id",
        "name",
        "nickname",
        "rank",
        "tabaka",
        "has_tadlis",
        "has_ikhtilat",
        "birth_year",
        "birth_year_raw",
        "death_year",
        "death_year_raw",
        "iqama",
        "death_place",
        "is_stub",
    ),
    "aqwal": ("id", "rawi_id", "alem_id", "qawl"),
    "alems": ("id", "shuhra"),
}
GRADE_COLUMNS = frozenset({"matn", "matn_no", "hukum", "max_rank"})


@dataclass
class Mention:
    seq: int
    rawi_id: int | None
    start: int
    end: int


@dataclass
class Chain:
    sanad_id: int
    rawi_ids: list[int]  # position 0 first (the compiler when present)


@dataclass
class KGEntry:
    id: int
    no_inbook: int
    type_no: int  # 0 قدسي, 1 مرفوع, 2 موقوف, 3 مقطوع
    group_id: int | None
    nass: str
    matn_start: int | None
    matn_end: int | None
    chains: list[Chain] = field(default_factory=list)
    mentions: list[Mention] = field(default_factory=list)


@dataclass
class Rawi:
    id: int
    name: str
    nickname: str
    rank: str | None
    tabaka: int | None
    has_tadlis: bool
    has_ikhtilat: bool
    birth_year: int | None
    birth_year_raw: str | None
    death_year: int | None
    death_year_raw: str | None
    iqama: str | None
    death_place: str | None
    is_stub: bool


@dataclass
class Qawl:
    id: int
    rawi_id: int
    critic: str
    text: str


def _cols(table: str) -> str:
    return ", ".join(f'"{c}"' for c in SELECTED_COLUMNS[table])


def connect(path: Path) -> sqlite3.Connection:
    # immutable=1: read-only without -wal/-shm side files beside the checksummed original.
    return sqlite3.connect(f"file:{path}?immutable=1", uri=True)


def load_entries(con: sqlite3.Connection) -> list[KGEntry]:
    entries = {
        r[0]: KGEntry(*r)
        for r in con.execute(
            f"SELECT {_cols('hadiths')} FROM hadiths WHERE book_id = ? ORDER BY id", (BUKHARI_BOOK_ID,)
        )
    }
    chains: dict[int, Chain] = {}
    for sid, hid in con.execute(
        f"SELECT {_cols('sanads')} FROM sanads "
        "WHERE hadith_id IN (SELECT id FROM hadiths WHERE book_id = ?) ORDER BY id",
        (BUKHARI_BOOK_ID,),
    ):
        chains[sid] = Chain(sid, [])
        entries[hid].chains.append(chains[sid])
    for sid, _pos, rid in con.execute(
        f"SELECT {_cols('sanad_rawis')} FROM sanad_rawis WHERE sanad_id IN "
        "(SELECT s.id FROM sanads s JOIN hadiths h ON h.id = s.hadith_id WHERE h.book_id = ?) ORDER BY sanad_id, pos",
        (BUKHARI_BOOK_ID,),
    ):
        chains[sid].rawi_ids.append(rid)
    for hid, seq, rid, start, end in con.execute(
        f"SELECT {_cols('hadith_rawis')} FROM hadith_rawis WHERE hadith_id IN "
        "(SELECT id FROM hadiths WHERE book_id = ?) ORDER BY hadith_id, seq",
        (BUKHARI_BOOK_ID,),
    ):
        entries[hid].mentions.append(Mention(seq, rid, start, end))
    return list(entries.values())


def load_rawis(con: sqlite3.Connection, ids: set[int]) -> dict[int, Rawi]:
    out: dict[int, Rawi] = {}
    ordered = sorted(ids)
    for i in range(0, len(ordered), 500):
        chunk = ordered[i : i + 500]
        q = f"SELECT {_cols('rawis')} FROM rawis WHERE id IN ({','.join('?' * len(chunk))})"
        for r in con.execute(q, chunk):
            out[r[0]] = Rawi(
                r[0],
                r[1],
                r[2],
                r[3],
                r[4],
                bool(r[5]),
                bool(r[6]),
                r[7],
                r[8],
                r[9],
                r[10],
                r[11],
                r[12],
                bool(r[13]),
            )
    return out


def load_aqwal(con: sqlite3.Connection, rawi_ids: set[int]) -> list[Qawl]:
    out: list[Qawl] = []
    ordered = sorted(rawi_ids)
    for i in range(0, len(ordered), 500):
        chunk = ordered[i : i + 500]
        q = (
            "SELECT q.id, q.rawi_id, a.shuhra, q.qawl FROM aqwal q JOIN alems a ON a.id = q.alem_id "
            f"WHERE q.rawi_id IN ({','.join('?' * len(chunk))}) ORDER BY q.id"
        )
        out.extend(Qawl(*r) for r in con.execute(q, chunk))
    return out
