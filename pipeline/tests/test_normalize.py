"""Shared vectors (fixtures/normalization-cases.json) plus property tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import strategies as st

from normalize import PROTECTED, analyze, normalize, stem

CASES = json.loads((Path(__file__).parents[2] / "fixtures" / "normalization-cases.json").read_text("utf-8"))


@pytest.mark.parametrize("case", CASES["normalize"], ids=lambda c: c["note"])
def test_normalize_vectors(case: dict[str, str]) -> None:
    assert normalize(case["input"]) == case["expected"]


@pytest.mark.parametrize("case", CASES["stem"], ids=lambda c: c["note"])
def test_stem_vectors(case: dict[str, str]) -> None:
    assert stem(case["input"]) == case["expected"]


@pytest.mark.parametrize("case", CASES["analyze"], ids=lambda c: c["note"])
def test_analyze_vectors(case: dict[str, object]) -> None:
    assert analyze(str(case["input"])) == (case["surface"], case["stem"])


# Arabic block, Arabic punctuation, Latin, whitespace and the \uFDFA ligature.
arabicish = st.text(
    alphabet=st.one_of(
        st.characters(min_codepoint=0x0600, max_codepoint=0x06FF),
        st.sampled_from(list(" \t\n.,;:«»()\u200f\u200e\ufdfa")),
        st.characters(min_codepoint=0x41, max_codepoint=0x7A),
    ),
    max_size=80,
)


@given(arabicish)
def test_normalize_is_idempotent(s: str) -> None:
    once = normalize(s)
    assert normalize(once) == once


@given(arabicish)
def test_normalized_has_no_marks_or_variants(s: str) -> None:
    out = normalize(s)
    forbidden = set("\u0640\u0670أإآٱىةؤئ\u06a9\u06cc٠١٢٣٤٥٦٧٨٩،؛؟«»")
    forbidden |= {chr(c) for c in range(0x064B, 0x0660)} | {chr(c) for c in range(0x06D6, 0x06EE)}
    assert not (set(out) & forbidden)
    assert out == out.strip() and "  " not in out


@given(arabicish)
def test_stem_never_shorter_than_three_unless_unchanged(s: str) -> None:
    for tok in normalize(s).split():
        st_ = stem(tok)
        assert st_ == tok or len(st_) >= 3
        assert tok.endswith(st_)
        if tok in PROTECTED:
            assert st_ == tok
