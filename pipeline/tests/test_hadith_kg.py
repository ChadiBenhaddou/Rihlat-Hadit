"""Hadith-KG adapter: principle 2 (no automatic verdicts) and, when downloaded, the golden fixture."""

from __future__ import annotations

import inspect
import re
from pathlib import Path

import pytest

from adapters import hadith_kg

DB = Path(__file__).parents[2] / "data" / "raw" / "hadith-kg" / "2026-07-31" / "hadith-kg.db"


def test_no_grade_column_is_ever_selected() -> None:
    for table, cols in hadith_kg.SELECTED_COLUMNS.items():
        assert not (set(cols) & hadith_kg.GRADE_COLUMNS), table
    # Literal SQL in the module must not name a grade column either (matn_start/matn_end are offsets).
    src = inspect.getsource(hadith_kg)
    sql = " ".join(re.findall(r'"(SELECT[^"]*|[^"]*FROM[^"]*)"', src))
    for col in hadith_kg.GRADE_COLUMNS:
        assert not re.search(rf"\b\w*\.?{col}\b(?!_)", sql), col


@pytest.mark.skipif(not DB.exists(), reason="raw source not downloaded")
def test_golden_fixture_chain() -> None:
    con = hadith_kg.connect(DB)
    entries = {e.no_inbook: e for e in hadith_kg.load_entries(con)}
    e = entries[1]
    assert not hasattr(e, "matn") and not hasattr(e, "hukum")
    chain = e.chains[0].rawi_ids
    rawis = hadith_kg.load_rawis(con, set(chain))
    names = [rawis[r].nickname for r in chain]
    assert names[0] == "محمد بن إسماعيل البخاري"
    assert names[2] == "سفيان بن عيينة الهلالي"  # not al-Thawri: al-Humaydi is his student
    assert names[3] == "يحيى بن سعيد الأنصاري"
    assert names[-1] == "عمر بن الخطاب العدوي"
