"""Transmission phrases (صيغ الأداء) and gap detection from the isnad text (SPEC §8 step 3).

A link's phrase is read from the text just before the narrator's mention: the
gap between the previous mention (or the start of the isnad) and this one.
Only a phrase at the very end of that gap counts. A gap such as «قال: كان»
yields no phrase rather than a guess.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from normalize import normalize

# Normalized transmission verbs and particles. The stored phrase keeps the
# original letters (tashkeel removed), e.g. «أخبرني», «أنه سمع».
TERMS: frozenset[str] = frozenset(
    {
        "حدثنا",
        "حدثني",
        "حدثناه",
        "حدثه",
        "حدثهم",
        "حدثاه",
        "حدثوا",
        "حدثتني",
        "حدثته",
        "يحدث",
        "تحدث",
        "اخبرنا",
        "اخبرني",
        "اخبره",
        "اخبرهم",
        "اخبراه",
        "اخبرته",
        "اخبرتني",
        "يخبر",
        "انبانا",
        "انباني",
        "سمعت",
        "سمع",
        "سمعنا",
        "سمعه",
        "سمعا",
        "يقول",
        "تقول",
        "عن",
        "ان",
        "انه",
        "انها",
        "انهما",
        "قال",
        "قالت",
        "قالا",
        "وقال",
        "وقالت",
        "ثنا",
        "نا",
        "انا",
    }
)
_PARTICLES = frozenset({"انه", "انها", "انهما", "انهم"})
# Phrases that introduce a narration without a stated hearing at the first link: معلق.
SUSPENSION: frozenset[str] = frozenset(
    {
        "قال",
        "وقال",
        "قالت",
        "وقالت",
        "ويذكر",
        "يذكر",
        "وروي",
        "روي",
        "ورواه",
        "رواه",
        "وزاد",
        "زاد",
        "وتابعه",
        "تابعه",
    }
)
_TASHKEEL = re.compile(r"[\u064B-\u065F\u0670\u0640]")
_WORD = re.compile(r"[ء-يٱ-ۓ\u064B-\u065F\u0670\u0640]+")


@dataclass(frozen=True)
class Phrase:
    """A transmission phrase as written (tashkeel removed) and its last normalized token."""

    text: str
    key: str


def phrase_before(gap: str) -> Phrase | None:
    """The transmission phrase ending the gap, if the gap ends in one."""
    words = _WORD.findall(gap)
    if not words:
        return None
    keys = [normalize(w) for w in words]
    if keys[-1] not in TERMS and keys[-1] not in SUSPENSION:
        return None
    start = len(words) - 1
    if start > 0 and keys[start - 1] in _PARTICLES and keys[start] not in _PARTICLES:
        start -= 1  # «أنه سمع»
    text = " ".join(_TASHKEEL.sub("", w) for w in words[start:])
    return Phrase(text, keys[-1])


def is_suspension(phrase: Phrase | None) -> bool:
    """Whether the phrase before the first named link marks a معلق narration.

    Bare «قال» or «وقال» with no hearing verb counts; «قال لي» or «قال لنا» does
    not, because the pronoun states that al-Bukhari heard it.
    """
    return phrase is not None and phrase.key in SUSPENSION


# The Prophet \uFDFA as the source of a chain: «رسول الله» or «النبي», whose
# honorific follows in the text (\uFDFA, or the phrase spelled out).
_PROPHET = re.compile(r"(?:رسول\s+الله|النبي|نبي\s+الله)(?=\s*(?:\uFDFA|صلى\s+الله\s+عليه\s+وسلم))")


def find_prophet(text: str, start: int, end: int) -> tuple[int, int] | None:
    """Offsets of the Prophet's first mention in text[start:end], matched on unvocalized letters."""
    # Map each unvocalized character back to its offset in the original text.
    plain, index = [], []
    for i in range(start, min(end, len(text))):
        ch = text[i]
        if _TASHKEEL.match(ch):
            continue
        plain.append(ch)
        index.append(i)
    m = _PROPHET.search("".join(plain))
    if not m:
        return None
    end_at = index[m.end() - 1] + 1
    while end_at < len(text) and _TASHKEEL.match(text[end_at]):
        end_at += 1  # keep the last letter's marks with it
    return index[m.start()], end_at
