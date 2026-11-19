"""Rewrite invisible or confusable characters in source files as escape sequences.

Usage: python scripts/escape-invisible.py [--code] FILE...

Default (data) mode escapes format characters (Cf), tatweel, Quranic marks,
the ligature U+FDFA, Persian kaf/ya, and combining marks that do not follow a
base letter. --code mode escapes every combining mark too, which is what regex
character classes need. CI runs it with --check to keep source legible.
"""

from __future__ import annotations

import sys
import unicodedata
from pathlib import Path

BS = chr(92)
ALWAYS = {0x0640, 0xFDFA, 0x06A9, 0x06CC} | set(range(0x06D6, 0x06EE))


def needs_escape(ch: str, prev: str, code: bool) -> bool:
    cp = ord(ch)
    cat = unicodedata.category(ch)
    if cp in ALWAYS or cat == "Cf":
        return True
    if cat in ("Mn", "Me"):
        return code or not (prev and unicodedata.category(prev)[0] in ("L", "M"))
    return False


def escape(text: str, code: bool) -> str:
    out = []
    prev = ""
    for ch in text:
        out.append(f"{BS}u{ord(ch):04X}" if needs_escape(ch, prev, code) else ch)
        prev = ch
    return "".join(out)


def main(argv: list[str]) -> int:
    code = "--code" in argv
    check = "--check" in argv
    files = [a for a in argv if not a.startswith("--")]
    dirty = []
    for f in files:
        p = Path(f)
        src = p.read_text("utf-8")
        new = escape(src, code)
        if new != src:
            dirty.append(f)
            if not check:
                p.write_text(new, "utf-8")
    if check and dirty:
        print("unescaped invisible characters in:", *dirty, sep="\n  ")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
