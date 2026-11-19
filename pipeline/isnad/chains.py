"""Build chain links from a dataset chain plus the entry's text (SPEC §7 chain_links, §8 step 3).

Inputs per route: narrator ids in chain order (al-Bukhari first) and the
entry's narrator mentions, in text order, with character offsets. Each link
gets its mention as written, the offsets, and the transmission phrase read
from the gap before the mention.

Mentions are matched to links greedily: for each link, the next mention
after the previous link's mention with the same narrator id. Routes split at
ح or at «فلان وفلان» share mentions this way, because each route walks
forward from its own start.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from isnad.terms import find_prophet, is_suspension, phrase_before


@dataclass(frozen=True)
class MentionIn:
    narrator_id: int | None
    start: int
    end: int


@dataclass
class Link:
    position: int
    narrator_id: int | None
    mention_ar: str | None  # None only for position 0 (the compiler, implicit)
    mention_start: int | None
    mention_end: int | None
    term_ar: str | None
    link_kind: str  # connected | suspended | gap | uncertain
    resolution: str = "dataset"  # dataset | auto | manual | unresolved


@dataclass(frozen=True)
class Placeholders:
    """Dataset ids that mark a property of the chain rather than a person."""

    link_kind: dict[int, str]  # placeholder id → kind given to the NEXT real link
    unnamed: frozenset[int]  # an unnamed narrator («رجل»): kept as an unresolved node


NO_PLACEHOLDERS = Placeholders({}, frozenset())


@dataclass
class Route:
    links: list[Link]
    is_suspended: bool
    ends_with_prophet: bool
    warnings: list[str]


def build_route(
    text: str,
    isnad_end: int,
    chain: Sequence[int],
    mentions: Sequence[MentionIn],
    compiler_id: int,
    prophet_id: int,
    marfu: bool,
    placeholders: Placeholders = NO_PLACEHOLDERS,
) -> Route:
    warnings: list[str] = []
    ids = list(chain)
    if not ids or ids[0] != compiler_id:
        ids.insert(0, compiler_id)
        warnings.append("compiler missing at position 0; added")

    links = [Link(0, compiler_id, None, None, None, None, "connected")]
    cursor = -1  # index into mentions of the previous link's mention
    pending: str | None = None  # kind set by a placeholder for the next real link
    for nid in ids[1:]:
        if nid in placeholders.link_kind:
            pending = placeholders.link_kind[nid]
            continue
        pos = len(links)
        # Forward first (routes walk the text in order); otherwise the nearest earlier
        # mention, which is how a later route reuses names already given («تابعه …»).
        found = next((i for i in range(cursor + 1, len(mentions)) if mentions[i].narrator_id == nid), None)
        if found is None:
            found = next(
                (i for i in range(min(cursor, len(mentions) - 1), -1, -1) if mentions[i].narrator_id == nid), None
            )
        unnamed = nid in placeholders.unnamed
        out_id = None if unnamed else nid
        resolution = "unresolved" if unnamed else "dataset"
        if found is None:
            warnings.append(f"position {pos}: narrator {nid} has no mention in the text")
            links.append(Link(pos, out_id, None, None, None, None, pending or "connected", resolution))
            pending = None
            continue
        m = mentions[found]
        gap_start = mentions[found - 1].end if found > 0 else 0
        phrase = phrase_before(text[gap_start : m.start])
        kind = pending or ("suspended" if pos == 1 and is_suspension(phrase) else "connected")
        links.append(
            Link(pos, out_id, text[m.start : m.end], m.start, m.end, phrase.text if phrase else None, kind, resolution)
        )
        pending = None
        cursor = found

    ends_with_prophet = False
    if marfu:
        last = next((lk for lk in reversed(links) if lk.mention_end is not None), None)
        if last is not None and last.mention_end is not None:
            span = find_prophet(text, last.mention_end, max(isnad_end, last.mention_end) + 120)
            if span is not None:
                phrase = phrase_before(text[last.mention_end : span[0]])
                links.append(
                    Link(
                        len(links),
                        prophet_id,
                        text[span[0] : span[1]],
                        span[0],
                        span[1],
                        phrase.text if phrase else None,
                        pending or "connected",  # «موضع إرسال» before the Prophet: a gap
                        "auto",
                    )
                )
                ends_with_prophet = True
        if not ends_with_prophet:
            warnings.append("marfu entry, but the Prophet's mention was not found after the last narrator")

    seen: set[int] = set()
    for lk in links:
        if lk.narrator_id is not None and lk.narrator_id in seen:
            warnings.append(f"narrator {lk.narrator_id} repeats within the chain")
        if lk.narrator_id is not None:
            seen.add(lk.narrator_id)
    return Route(links, links[1].link_kind == "suspended" if len(links) > 1 else False, ends_with_prophet, warnings)
