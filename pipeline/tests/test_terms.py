"""Transmission phrases, suspension and the Prophet's mention (golden fixture, SPEC §16)."""

from __future__ import annotations

from isnad.terms import find_prophet, is_suspension, phrase_before

# TEST FIXTURE: the isnad of Bukhari no. 1 as a parser expectation (SPEC §16), not content.
ISNAD_1 = (
    "حَدَّثَنَا الْحُمَيْدِيُّ عَبْدُ اللَّهِ بْنُ الزُّبَيْرِ ، قَالَ : حَدَّثَنَا سُفْيَانُ ، قَالَ : "
    "حَدَّثَنَا يَحْيَى بْنُ سَعِيدٍ الْأَنْصَارِيُّ ، قَالَ : أَخْبَرَنِي مُحَمَّدُ بْنُ إِبْرَاهِيمَ التَّيْمِيُّ ، "
    "أَنَّهُ سَمِعَ عَلْقَمَةَ بْنَ وَقَّاصٍ اللَّيْثِيَّ ، يَقُولُ : سَمِعْتُ عُمَرَ بْنَ الْخَطَّابِ رَضِيَ اللَّهُ عَنْهُ "
    "عَلَى الْمِنْبَرِ ، قَالَ : سَمِعْتُ رَسُولَ اللَّهِ ﷺ ، يَقُولُ : "
)
MENTIONS = [
    "الْحُمَيْدِيُّ عَبْدُ اللَّهِ بْنُ الزُّبَيْرِ",
    "سُفْيَانُ",
    "يَحْيَى بْنُ سَعِيدٍ الْأَنْصَارِيُّ",
    "مُحَمَّدُ بْنُ إِبْرَاهِيمَ التَّيْمِيُّ",
    "عَلْقَمَةَ بْنَ وَقَّاصٍ اللَّيْثِيَّ",
    "عُمَرَ بْنَ الْخَطَّابِ",
]


def test_golden_fixture_phrases() -> None:
    expected = ["حدثنا", "حدثنا", "حدثنا", "أخبرني", "أنه سمع", "سمعت"]
    got, cursor = [], 0
    for m in MENTIONS:
        at = ISNAD_1.index(m, cursor)
        p = phrase_before(ISNAD_1[cursor:at])
        got.append(p.text if p else None)
        cursor = at + len(m)
    assert got == expected
    span = find_prophet(ISNAD_1, cursor, len(ISNAD_1))
    assert span is not None
    p = phrase_before(ISNAD_1[cursor : span[0]])
    assert p is not None and p.text == "سمعت"
    assert ISNAD_1[span[0] : span[1]] == "رَسُولَ اللَّهِ"


def test_gap_not_ending_in_a_phrase_yields_none() -> None:
    assert phrase_before("، قَالَ : كَانَ") is None
    assert phrase_before("") is None


def test_suspension() -> None:
    assert is_suspension(phrase_before("وَقَالَ"))
    assert is_suspension(phrase_before("وَيُذْكَرُ عَنْ")) is False  # «عن» ends the gap
    assert is_suspension(phrase_before("وَيُذْكَرُ"))
    assert not is_suspension(phrase_before("حَدَّثَنَا"))
    assert not is_suspension(phrase_before("قَالَ لِي"))


def test_prophet_requires_honorific_and_ignores_tashkeel() -> None:
    t = "عَنْ النَّبِيِّ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ"
    span = find_prophet(t, 0, len(t))
    assert span is not None and t[span[0] : span[1]] == "النَّبِيِّ"
    assert find_prophet("قال النبي", 0, 9) is None
