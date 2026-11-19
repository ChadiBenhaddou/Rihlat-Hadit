"""Arabic normalizer and light stemmer (SPEC §9).

Python twin of ``packages/shared/src/arabic.ts``. Both must pass
``fixtures/normalization-cases.json``; change them together.

Normalized text is for matching only. Never display it.

Code points are written as numbers on purpose: combining marks are invisible
in source, and formatters may otherwise rewrite escapes into literal marks.
"""

from __future__ import annotations

import re
import unicodedata

__all__ = ["PROCLITICS", "PROTECTED", "analyze", "normalize", "stem", "tokenize"]

# Step 2: tashkeel and Quranic marks (U+064B–U+065F, U+0670, U+06D6–U+06ED), tatweel (U+0640).
# A raw string: the re module itself reads the \u escapes.
_MARKS = re.compile(r"[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]")

# Step 3: letter variants.
_FOLD = str.maketrans(
    {
        chr(0x0623): chr(0x0627),  # alef with hamza above → alef
        chr(0x0625): chr(0x0627),  # alef with hamza below → alef
        chr(0x0622): chr(0x0627),  # alef with madda → alef
        chr(0x0671): chr(0x0627),  # alef wasla → alef
        chr(0x0649): chr(0x064A),  # alef maqsura → ya
        chr(0x0629): chr(0x0647),  # taa marbuta → ha
        chr(0x0624): chr(0x0648),  # waw with hamza → waw
        chr(0x0626): chr(0x064A),  # ya with hamza → ya
        chr(0x06A9): chr(0x0643),  # Persian kaf → kaf
        chr(0x06CC): chr(0x064A),  # Persian ya → ya
    }
)

# Step 4: Arabic-Indic (U+0660–9) and Extended Arabic-Indic (U+06F0–9) digits.
_DIGITS = str.maketrans(
    {**{chr(0x0660 + i): str(i) for i in range(10)}, **{chr(0x06F0 + i): str(i) for i in range(10)}}
)

_WS = re.compile(r"\s+")

# Longest first; SPEC §9.
PROCLITICS: tuple[str, ...] = ("وال", "بال", "كال", "فال", "لل", "ال", "و")
PROTECTED: frozenset[str] = frozenset({"الله", "اللهم"})
_MIN_STEM = 3


def _is_separator(ch: str) -> bool:
    """Step 5: punctuation (P*), symbols (S*) and separators (Z*) become spaces."""
    return unicodedata.category(ch)[0] in ("P", "S", "Z")


def normalize(text: str) -> str:
    """Normalize Arabic text for matching, in the order SPEC §9 fixes."""
    s = unicodedata.normalize("NFKC", text)
    # Bidi marks and zero-width joiners (Cf) carry no letters; drop them with the marks.
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Cf")
    s = _MARKS.sub("", s)
    s = s.translate(_FOLD)
    s = s.translate(_DIGITS)
    s = "".join(" " if _is_separator(ch) else ch for ch in s)
    return _WS.sub(" ", s).strip()


def stem(token: str) -> str:
    """Strip one proclitic from an already normalized token, keeping at least 3 letters."""
    if token in PROTECTED:
        return token
    for p in PROCLITICS:
        if token.startswith(p) and len(token) - len(p) >= _MIN_STEM:
            return token[len(p) :]
    return token


def tokenize(text: str) -> list[str]:
    n = normalize(text)
    return n.split(" ") if n else []


def analyze(text: str) -> tuple[list[str], list[str]]:
    """Return (surface tokens, stem tokens) for the FTS5 columns."""
    surface = tokenize(text)
    return surface, [stem(t) for t in surface]
