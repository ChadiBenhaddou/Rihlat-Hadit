"""Chain-link building. Texts are TEST FIXTURES (parser expectations), not content."""

from __future__ import annotations

from isnad.chains import MentionIn, build_route
from tests.test_terms import ISNAD_1, MENTIONS

BUKHARI, PROPHET = 1, 999
IDS = [10, 11, 12, 13, 14, 15]  # placeholder narrator ids for the six mentions of no. 1


def mentions_of(text: str, names: list[str], ids: list[int]) -> list[MentionIn]:
    out, cursor = [], 0
    for name, nid in zip(names, ids, strict=True):
        at = text.index(name, cursor)
        out.append(MentionIn(nid, at, at + len(name)))
        cursor = at + len(name)
    return out


def test_golden_fixture_route() -> None:
    r = build_route(ISNAD_1, len(ISNAD_1), [BUKHARI, *IDS], mentions_of(ISNAD_1, MENTIONS, IDS), BUKHARI, PROPHET, True)
    assert [lk.position for lk in r.links] == list(range(8))
    assert [lk.narrator_id for lk in r.links] == [BUKHARI, *IDS, PROPHET]
    assert [lk.term_ar for lk in r.links] == [None, "حدثنا", "حدثنا", "حدثنا", "أخبرني", "أنه سمع", "سمعت", "سمعت"]
    assert r.links[0].mention_ar is None and r.links[0].mention_start is None
    assert r.links[2].mention_ar == "سُفْيَانُ"
    assert r.ends_with_prophet and not r.is_suspended
    assert r.warnings == []


def test_compiler_added_when_missing() -> None:
    r = build_route(ISNAD_1, len(ISNAD_1), IDS, mentions_of(ISNAD_1, MENTIONS, IDS), BUKHARI, PROPHET, True)
    assert r.links[0].narrator_id == BUKHARI
    assert "compiler missing at position 0; added" in r.warnings


def test_suspended_first_link() -> None:
    text = "وَقَالَ زَيْدٌ ، عَنْ عَمْرٍو ، عَنِ النَّبِيِّ \ufdfa : نص"
    ms = mentions_of(text, ["زَيْدٌ", "عَمْرٍو"], [20, 21])
    r = build_route(text, text.index(":"), [BUKHARI, 20, 21], ms, BUKHARI, PROPHET, True)
    assert r.is_suspended
    assert r.links[1].link_kind == "suspended" and r.links[1].term_ar == "وقال"
    assert r.links[2].link_kind == "connected" and r.links[2].term_ar == "عن"
    assert r.links[3].narrator_id == PROPHET


def test_routes_split_at_ha_share_mentions() -> None:
    # «حدثنا أ عن ب . ح وحدثنا ج عن ب عن د»: route 2 must take the second mention of ب.
    text = "حَدَّثَنَا أَلِف عَنْ بَاء . ح وَحَدَّثَنَا جِيم عَنْ بَاء عَنْ دَال"
    ms = mentions_of(text, ["أَلِف", "بَاء", "جِيم", "بَاء", "دَال"], [30, 31, 32, 31, 33])
    r1 = build_route(text, len(text), [BUKHARI, 30, 31, 33], ms, BUKHARI, PROPHET, False)
    r2 = build_route(text, len(text), [BUKHARI, 32, 31, 33], ms, BUKHARI, PROPHET, False)
    assert r1.links[2].mention_start == ms[1].start
    assert r1.links[3].mention_start == ms[4].start  # ب → د skips forward past route 2's names
    assert r2.links[2].mention_start == ms[3].start
    assert r2.links[1].term_ar == "وحدثنا"
