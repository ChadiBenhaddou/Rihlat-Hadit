"""Evaluation only (docs/data-sources.md): map Hadith-KG Bukhari entries to Tawq al-Najat reference numbers by word 4-grams.

Run from the repository root: python3 -I pipeline/evaluate/map_kg_to_reference.py
"""

import collections
import re
import sqlite3
import sys

sys.path.insert(0, "pipeline")
from normalize import normalize

lines = (
    open("data/raw/openiti-bukhari/2025.1.9/0256Bukhari.Sahih.Shamela0001681-ara1", encoding="utf-8").read().split("\n")
)
ref = {}
cur = None
for i, l in enumerate(lines):
    m = re.fullmatch(r"### \| (\d+) -\s*", l)
    if m and i + 1 < len(lines) and not lines[i + 1].startswith("### "):
        cur = int(m.group(1))
        ref[cur] = ""
        continue
    if l.startswith("### "):
        if not l.startswith("### | [ص"):
            cur = None
        continue
    if cur is not None and (l.startswith("# ") or l.startswith("~~")):
        ref[cur] += " " + l[2:]
STOP = {"قال", "قالت", "ان", "انه", "بن", "ابن"}


def toks(t):
    t = re.sub(r"PageV\d+P\d+|ms\d+", " ", t)
    return [w for w in normalize(t).split() if w not in STOP]


idx = collections.defaultdict(set)
reftoks = {n: toks(t) for n, t in ref.items()}
for n, ts in reftoks.items():
    for g in zip(ts, ts[1:], ts[2:], ts[3:]):
        idx[g].add(n)
c = sqlite3.connect("file:data/raw/hadith-kg/2026-07-31/hadith-kg.db?mode=ro", uri=True)
rows = c.execute("SELECT no_inbook, nass FROM hadiths WHERE book_id=1").fetchall()
res = {}
amb = 0
for no, nass in rows:
    ts = toks(nass)
    votes = collections.Counter()
    grams = list(zip(ts, ts[1:], ts[2:], ts[3:]))
    for g in grams:
        cands = idx.get(g, ())
        if len(cands) <= 20:
            for n in cands:
                votes[n] += 1
    if not votes:
        continue
    (best, v), *rest = votes.most_common(2) + [(None, 0)]
    cover = v / max(1, len(grams))
    second = rest[0][1] if rest else 0
    if cover >= 0.6 and v > 1.3 * second:
        res[no] = (best, cover)
    else:
        amb += 1
mapped = set(n for n, _ in res.values())
print(
    "kg bukhari rows",
    len(rows),
    "confidently mapped",
    len(res),
    "ambiguous",
    amb,
    "unmapped",
    len(rows) - len(res) - amb,
)
print("distinct ref numbers hit", len(mapped), "of", len(ref), "; collisions", len(res) - len(mapped))
print("kg no.1 ->", res.get(1), " kg no.3000 ->", res.get(3000))
