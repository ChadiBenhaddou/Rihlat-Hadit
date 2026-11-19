"""Tawq al-Najat adapter: markup quirks (fixture) and real-file coverage (when downloaded)."""

from __future__ import annotations

from pathlib import Path

import pytest

from adapters.tawq import FILE_NAME, parse

ROOT = Path(__file__).parents[2]
FIXTURE = ROOT / "fixtures" / "openiti" / "tawq-markup.txt"
REAL = ROOT / "data" / "raw" / "openiti-bukhari" / "2025.1.9" / FILE_NAME


def test_kitab_one_has_no_dollar_heading() -> None:
    r = parse(FIXTURE)
    assert [(k.number, k.title) for k in r.kitabs] == [
        (1, "بدء الوحي"),
        (2, "كتاب الثاني"),
        (3, "كتاب الثالث"),
    ]
    assert [b.title for b in r.kitabs[0].babs] == ["باب الأول"]


def test_entry_text_spans_lines_and_page_breaks() -> None:
    e = parse(FIXTURE).entries[1]
    assert (e.kitab, e.bab_seq) == (1, 1)
    assert e.text == "نص أ تتمة أ بقية أ"


def test_milestones_inside_number_headings() -> None:
    assert parse(FIXTURE).entries[2].text == "نص ب"


def test_numbers_printed_together_share_text() -> None:
    r = parse(FIXTURE)
    for n in (3, 4, 5):
        assert r.entries[n].text == "نص مشترك"
        assert r.entries[n].kitab == 2
    assert r.entries[4].shared_with == (3, 5)


def test_title_on_next_line_and_entry_before_first_bab() -> None:
    r = parse(FIXTURE)
    assert r.kitabs[2].title == "كتاب الثالث"
    assert r.entries[6].bab_seq is None
    assert r.entries[7].bab_seq == 1


@pytest.mark.skipif(not REAL.exists(), reason="raw source not downloaded")
def test_real_file_coverage() -> None:
    r = parse(REAL)
    assert [k.number for k in r.kitabs] == list(range(1, 98))
    assert max(r.entries) == 7563
    assert len(r.entries) >= 7390  # 173 numbers are absent from this digital text (docs/data-sources.md)
    first = r.entries[1].text
    assert first.startswith("حدثنا الحميدي عبد الله بن الزبير")
    assert "إنما الأعمال بالنيات" in first
