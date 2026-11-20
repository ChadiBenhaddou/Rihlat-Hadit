"""Adapter: Sahih al-Bukhari, Dar Tawq al-Najat text from OpenITI (Shamela0001681).

Supplies the reference numbering (1–7,563, Muhammad Fuad Abd al-Baqi) and
al-Bukhari's كتاب and باب titles. Licence: CC BY-NC-SA 4.0 (docs/data-sources.md).

Markup (OpenITI mARkdown, as used in this file):
    ### $ N - كتاب …      a كتاب (book); كتاب 1 «بدء الوحي» is the exception, see below
    ### | باب …           a باب (chapter)
    ### | N -             a numbered entry; its text follows on '# ' / '~~' lines
    ### | [ص: N]          a page break inside running text
    PageV01P006, ms0001   page and milestone markers inside text
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

SOURCE_SLUG = "openiti-tawq-al-najat"
FILE_NAME = "0256Bukhari.Sahih.Shamela0001681-ara1"

_KITAB = re.compile(r"### \$ (\d+) -\s*(.*?)\s*$")
_NUMBER = re.compile(r"### \| ((?:\d+ -\s*)+)$")
_CONTINUED = re.compile(r"# (\d+) -\s*$")
_PAGE = re.compile(r"### \| \[ص: [^\]]*\]\s*$")
_HEADING = re.compile(r"### \| (.+?)\s*$")
_INLINE_MARKERS = re.compile(r"PageV\d+P\d+|ms\d+")


@dataclass
class Bab:
    seq: int  # 1-based order within its كتاب
    title: str


@dataclass
class Kitab:
    number: int
    title: str
    babs: list[Bab] = field(default_factory=list)


@dataclass
class Entry:
    number: int
    kitab: int
    bab_seq: int | None  # None when the entry precedes the first باب of its كتاب
    text: str
    shared_with: tuple[int, ...] = ()  # other numbers printed on the same heading ("1162 - 1163 -")


@dataclass
class Reference:
    kitabs: list[Kitab]
    entries: dict[int, Entry]


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", _INLINE_MARKERS.sub(" ", text)).strip()


def parse(path: Path) -> Reference:
    lines = path.read_text("utf-8").split("\n")
    start = next(i for i, line in enumerate(lines) if line.startswith("#META#Header#End#"))
    kitabs: list[Kitab] = []
    entries: dict[int, Entry] = {}
    current: list[Entry] = []  # entries receiving text (several when a heading carries several numbers)
    in_body = False

    def bab_seq() -> int | None:
        return kitabs[-1].babs[-1].seq if kitabs and kitabs[-1].babs else None

    # Milestone markers can sit inside headings ("### | 69 ms0034 - ").
    lines = [re.sub(r" ms\d+", "", line) if line.startswith("### ") else line for line in lines]
    for i in range(start + 1, len(lines)):
        line = lines[i]
        if m := _KITAB.match(line):
            title = m.group(2).strip()
            if not title and lines[i + 1].startswith("# "):
                title = lines[i + 1][2:].strip()  # e.g. كتاب 19: the title sits on the next line
                lines[i + 1] = ""
            kitabs.append(Kitab(int(m.group(1)), _clean(title)))  # page markers can trail the title
            current = []
            in_body = True
            continue
        if _PAGE.match(line):
            continue  # page break inside running text: keep appending
        if m := _NUMBER.match(line):
            numbers = [int(n) for n in re.findall(r"\d+", m.group(1))]
            # Entries printed together continue on "# 1162 -" lines (e.g. 1161–1167).
            j = i + 1
            while (c := _CONTINUED.match(lines[j])) is not None:
                numbers.append(int(c.group(1)))
                lines[j] = ""
                j += 1
            if not in_body and numbers == [1]:
                # كتاب 1 has no `$` heading: "### | 1 - ", a stray "# باب" line, then "### | بدء الوحي".
                j = i + 1
                while not lines[j].startswith("### | "):
                    j += 1
                kitabs.append(Kitab(1, _clean(_HEADING.match(lines[j]).group(1))))  # type: ignore[union-attr]
                lines[j] = ""
                in_body = True
                current = []
                continue
            if not in_body:
                continue
            current = []
            for n in numbers:
                e = Entry(n, kitabs[-1].number, bab_seq(), "", tuple(x for x in numbers if x != n))
                entries.setdefault(n, e)
                current.append(entries[n])
            continue
        if m := _HEADING.match(line):
            if not in_body:
                continue
            title = m.group(1).strip()
            k = kitabs[-1]
            k.babs.append(Bab(len(k.babs) + 1, _clean(title)))
            current = []
            continue
        if current and (line.startswith("# ") or line.startswith("~~")):
            for e in current:
                e.text += " " + line[2:]
    for e in entries.values():
        e.text = _clean(e.text)
    return Reference(kitabs, entries)
