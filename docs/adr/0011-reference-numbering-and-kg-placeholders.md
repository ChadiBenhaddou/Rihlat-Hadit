# 0011 — Reference numbering by alignment; dataset placeholders become link kinds

**Status:** Accepted · 2026-11-19

## Context
Hadith-KG numbers its 7,031 Bukhari entries in its own sequence, and models breaks in a chain with placeholder "narrators" (ids 30000–30002) plus one shared "unnamed" narrator (1131). The spec needs the reference numbering 1–7,563 (SPEC §9) and wants suspensions and gaps drawn as broken links (principle 6).

## Decision
- **Numbering:** `pipeline/resolve/numbering.py` aligns KG entries with the Tawq al-Najat text. It scores word 4-grams with isnad grams weighted double, assigns one-to-one, keeps only matches in KG's book order (longest increasing subsequence), fills gaps by order with a text check, and unplaces any placement whose isnad opens with a different narrator. Result: 6,926 placed (98.5%); 105 go to review. Six placements rest on order alone, where the reference text is missing, and each is a review item.
- **Placeholders:** 30001 «موضع تعليق» marks the next link `suspended`; 30000 «موضع انقطاع» and 30002 «موضع إرسال» mark the next link `gap`. None becomes a narrator row. 1131 «اسم مبهم» becomes an unresolved node per (chain, position), so unrelated unnamed men never merge into one person.
- **The Prophet ﷺ** is our own narrator row (id 1,000,000, slug `al-nabi`, honorific ﷺ). He is linked only where the text names him after the last narrator. A مرفوع report that doesn't name him as the source ends at the Companion, as written (1,099 routes).
- **Narrator ids and slugs** reuse KG ids (`r<id>`) while KG is the only biographical source. A later source must map onto them, not renumber.

## Consequences
- 470 entries come from the reference text only and have no chain yet. Our own isnad parser and resolver must cover them before their graphs exist.
- If KG publishes a new version, the alignment reruns; placements are not hand-edited.
