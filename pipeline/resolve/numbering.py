"""Map Hadith-KG entries onto the reference numbering (Tawq al-Najat, 1–7,563).

Hadith-KG numbers its Bukhari entries in its own sequence. Each KG entry is
scored against every reference entry by shared word 4-grams. Grams from the
isnad count double, because al-Bukhari repeats a matn under many numbers and
the isnad is what tells the repetitions apart. Assignment is one-to-one,
best-scoring pairs first. A KG entry is left unmapped rather than forced when
its best match is weak or not clearly ahead of the runner-up.
"""

from __future__ import annotations

import itertools
import re
from collections import defaultdict
from collections.abc import Iterable, Mapping
from dataclasses import dataclass

from normalize import normalize

N = 4
ISNAD_WEIGHT = 2.0
MIN_COVER = 0.5  # share of the KG entry's weighted grams found in the candidate
MIN_MARGIN = 1.15  # best score must beat the runner-up by this factor
MAX_POSTINGS = 25  # ignore grams shared by more entries than this (formulae)

# Words whose presence varies between editions without changing the narration.
_STOP = frozenset({"قال", "قالت", "ان", "انه", "انها", "بن", "ابن", "عن", "حدثنا", "اخبرنا", "حدثني", "اخبرني"})
_MARKERS = re.compile(r"PageV\d+P\d+|ms\d+")


def tokens(text: str) -> list[str]:
    return [w for w in normalize(_MARKERS.sub(" ", text)).split() if w not in _STOP]


def grams(toks: list[str]) -> list[tuple[str, ...]]:
    return [tuple(toks[i : i + N]) for i in range(len(toks) - N + 1)]


@dataclass(frozen=True)
class Match:
    kg_id: int
    ref: int
    score: float
    cover: float
    margin: float


@dataclass
class Mapping_:
    matches: dict[int, Match]  # kg_id → match
    unmapped: dict[int, str]  # kg_id → reason


def map_entries(
    reference: Mapping[int, str],
    kg: Iterable[tuple[int, str, int | None]],  # (kg_id, nass, matn_start)
) -> Mapping_:
    index: dict[tuple[str, ...], set[int]] = defaultdict(set)
    for ref, text in reference.items():
        for g in set(grams(tokens(text))):
            index[g].add(ref)

    proposals: list[tuple[float, float, float, int, int]] = []
    unmapped: dict[int, str] = {}
    for kg_id, nass, matn_start in kg:
        split = matn_start if matn_start is not None else 0
        weighted: list[tuple[tuple[str, ...], float]] = [(g, ISNAD_WEIGHT) for g in grams(tokens(nass[:split]))]
        weighted += [(g, 1.0) for g in grams(tokens(nass[split:]))]
        total = sum(w for _, w in weighted)
        if total == 0:
            unmapped[kg_id] = "too short to match"
            continue
        votes: defaultdict[int, float] = defaultdict(float)
        for g, w in weighted:
            refs = index.get(g)
            if refs and len(refs) <= MAX_POSTINGS:
                for r in refs:
                    votes[r] += w
        if not votes:
            unmapped[kg_id] = "no shared text"
            continue
        ranked = sorted(votes.items(), key=lambda kv: -kv[1])
        # Every candidate within the margin of the best stays in play for the one-to-one pass.
        best = ranked[0][1]
        for ref, score in ranked[:5]:
            cover = score / total
            if cover < MIN_COVER:
                break
            runner = next((s for r, s in ranked if r != ref), 0.0)
            margin = score / runner if runner else float("inf")
            proposals.append((score / total, margin, score, kg_id, ref))
            if score < best / MIN_MARGIN:
                break
        if not any(p[3] == kg_id for p in proposals[-5:]):
            unmapped[kg_id] = f"best cover {best / total:.2f} below {MIN_COVER}"

    # One-to-one, strongest first: higher cover, then clearer margin.
    proposals.sort(key=lambda p: (-p[0], -p[1]))
    taken_ref: set[int] = set()
    matches: dict[int, Match] = {}
    for cover, margin, score, kg_id, ref_no in proposals:
        if kg_id in matches or ref_no in taken_ref:
            continue
        matches[kg_id] = Match(kg_id, ref_no, score, cover, margin)
        taken_ref.add(ref_no)
    for _, _, _, kg_id, _ in proposals:
        if kg_id not in matches and kg_id not in unmapped:
            unmapped[kg_id] = "every candidate number was taken by a stronger match"
    return Mapping_(matches, unmapped)


# --- Order refinement -------------------------------------------------------
# Hadith-KG lists its Bukhari entries in book order, so mapped reference
# numbers must rise along the KG sequence. Matches that break the order are
# dropped, and gaps between anchored entries are filled by sequence.

MIN_GAP_COVER = 0.2  # weak textual agreement still required inside a gap


@dataclass(frozen=True)
class Placed:
    kg_id: int
    ref: int
    method: str  # 'text' | 'order+text' | 'order' (no reference text to compare)
    cover: float | None


def _lis(values: list[int]) -> set[int]:
    """Indices of one longest strictly increasing subsequence."""
    import bisect

    tails: list[int] = []
    tails_idx: list[int] = []
    prev = [-1] * len(values)
    for i, v in enumerate(values):
        k = bisect.bisect_left(tails, v)
        if k == len(tails):
            tails.append(v)
            tails_idx.append(i)
        else:
            tails[k] = v
            tails_idx[k] = i
        prev[i] = tails_idx[k - 1] if k else -1
    out: set[int] = set()
    i = tails_idx[-1] if tails_idx else -1
    while i >= 0:
        out.add(i)
        i = prev[i]
    return out


def _cover(kg_text: str, ref_text: str) -> float:
    a = grams(tokens(kg_text))
    if not a:
        return 0.0
    b = set(grams(tokens(ref_text)))
    return sum(1 for g in a if g in b) / len(a)


def place_in_order(
    mapping: Mapping_,
    kg_order: list[tuple[int, str]],  # (kg_id, nass) in KG sequence
    reference: Mapping[int, str],
    ref_max: int,
) -> tuple[dict[int, Placed], dict[int, str]]:
    seq = [kid for kid, _ in kg_order]
    text = dict(kg_order)
    anchored = [(i, mapping.matches[k].ref) for i, k in enumerate(seq) if k in mapping.matches]
    keep = _lis([r for _, r in anchored])
    placed: dict[int, Placed] = {}
    unmapped = dict(mapping.unmapped)
    for j, (i, ref) in enumerate(anchored):
        kid = seq[i]
        if j in keep:
            placed[kid] = Placed(kid, ref, "text", mapping.matches[kid].cover)
        else:
            unmapped[kid] = "text match out of book order"
    taken = {p.ref for p in placed.values()}

    # Walk gaps between consecutive anchors (with sentinels 0 and ref_max + 1).
    anchors = [(-1, 0), *sorted((seq.index(p.kg_id), p.ref) for p in placed.values()), (len(seq), ref_max + 1)]
    for (i0, r0), (i1, r1) in itertools.pairwise(anchors):
        gap_kg = [seq[i] for i in range(i0 + 1, i1)]
        if not gap_kg:
            continue
        free = [r for r in range(r0 + 1, r1) if r not in taken]
        if len(free) != len(gap_kg):
            # Unequal gap: order-preserving alignment maximizing text agreement.
            for k, r, c in _align_gap(gap_kg, free, text, reference):
                placed[k] = Placed(k, r, "order+text", c)
                unmapped.pop(k, None)
                taken.add(r)
            for k in gap_kg:
                if k not in placed:
                    unmapped.setdefault(k, "gap size differs from free reference numbers")
            continue
        for k, r in zip(gap_kg, free, strict=True):
            if r in reference:
                c = _cover(text[k], reference[r])
                if c < MIN_GAP_COVER:
                    unmapped[k] = f"order suggests {r}, but texts disagree (cover {c:.2f})"
                    continue
                placed[k] = Placed(k, r, "order+text", c)
            else:
                placed[k] = Placed(k, r, "order", None)
            unmapped.pop(k, None)
            taken.add(r)
    # Guard: the isnad must open with the same narrator in both texts. A shared
    # matn under a neighbouring number is how repetitions get confused.
    for k in list(placed):
        r = placed[k].ref
        if r in reference and not opening_agrees(text[k], reference[r]):
            del placed[k]
            unmapped[k] = f"placed at {r}, but the isnad opens with a different narrator"
    for k in placed:
        unmapped.pop(k, None)
    return placed, unmapped


_OPENING_SKIP = frozenset({"حدثنا", "حدثني", "اخبرنا", "اخبرني", "قال", "وقال", "بن", "ح", "وحدثنا", "وحدثني"})


def opening_agrees(kg_text: str, ref_text: str) -> bool:
    """Whether one of the KG isnad's first three name words occurs among the reference's first ten."""

    def head(t: str, k: int) -> list[str]:
        return [w for w in normalize(_MARKERS.sub(" ", t)).split() if w not in _OPENING_SKIP][:k]

    window = set(head(ref_text, 10))
    return any(w in window for w in head(kg_text, 3) if len(w) > 2)


def _align_gap(
    gap_kg: list[int], free: list[int], text: Mapping[int, str], reference: Mapping[int, str]
) -> list[tuple[int, int, float]]:
    """Monotone pairing of KG entries with free numbers, maximizing summed cover ≥ MIN_GAP_COVER."""
    n, m = len(gap_kg), len(free)
    if n * m > 40_000:
        return []
    cov = [[_cover(text[k], reference[r]) if r in reference else 0.0 for r in free] for k in gap_kg]
    best = [[0.0] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(m - 1, -1, -1):
            pair = cov[i][j] + best[i + 1][j + 1] if cov[i][j] >= MIN_GAP_COVER else -1.0
            best[i][j] = max(best[i + 1][j], best[i][j + 1], pair)
    out: list[tuple[int, int, float]] = []
    i = j = 0
    while i < n and j < m:
        if cov[i][j] >= MIN_GAP_COVER and best[i][j] == cov[i][j] + best[i + 1][j + 1]:
            out.append((gap_kg[i], free[j], cov[i][j]))
            i += 1
            j += 1
        elif best[i][j] == best[i + 1][j]:
            i += 1
        else:
            j += 1
    return out
