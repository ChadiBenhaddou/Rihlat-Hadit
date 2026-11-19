"""Numbering alignment on TEST FIXTURE texts (placeholder narrations, not content)."""

from __future__ import annotations

from resolve.numbering import map_entries, opening_agrees, place_in_order

REF = {
    1: "حدثنا زيد قال حدثنا عمرو عن خالد عن سعيد قال سمعت النبي يقول الكلمه الاولي الطويله في هذا النص",
    2: "حدثنا بكر قال حدثنا عمرو عن خالد عن سعيد قال سمعت النبي يقول الكلمه الاولي الطويله في هذا النص",
    3: "حدثنا ماجد عن حامد عن راشد قال نص ثالث مختلف تماما عن غيره من النصوص",
    4: "حدثنا فاضل عن كامل عن نبيل قال نص رابع لا يشبه ما قبله ابدا",
}


def kg(kg_id: int, text: str) -> tuple[int, str, int | None]:
    return (kg_id, text, text.index("قال سمعت") if "قال سمعت" in text else None)


def test_repeated_matn_is_told_apart_by_isnad() -> None:
    m = map_entries(REF, [kg(10, REF[2]), kg(11, REF[1])])
    assert m.matches[10].ref == 2
    assert m.matches[11].ref == 1


def test_order_fills_a_gap_and_marks_missing_reference_text() -> None:
    entries = [(20, REF[1]), (21, "نص لا يطابق شيئا"), (22, REF[3])]
    m = map_entries(REF, [(k, t, None) for k, t in entries])
    placed, unmapped = place_in_order(m, entries, {n: t for n, t in REF.items() if n != 2}, ref_max=4)
    assert placed[20].ref == 1 and placed[22].ref == 3
    assert placed[21].ref == 2 and placed[21].method == "order"  # no reference text for 2
    assert 21 not in unmapped


def test_opening_guard() -> None:
    assert opening_agrees("حدثنا الحميدي قال", "حدثنا عبد الله بن الزبير الحميدي")
    assert not opening_agrees("حدثنا حامد بن عمر", "حدثنا عاصم بن علي")
