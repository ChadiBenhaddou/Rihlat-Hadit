# 0006 — Twin Arabic normalizers with shared vectors

**Status:** Accepted · 2026-11-19

## Context
Queries are normalized in the Worker (TypeScript); stored text is normalized in the pipeline (Python). Any difference silently breaks search.

## Decision
`packages/shared/src/arabic.ts` and `pipeline/normalize/__init__.py` implement SPEC §9 step by step, and both test suites load `fixtures/normalization-cases.json` (normalize, stem and analyze vectors). Python also runs Hypothesis property tests (idempotence, no forbidden characters, stems never shorter than three letters).

Two refinements beyond SPEC §9, applied in both languages:
1. Unicode format characters (category Cf: RLM, LRM, ZWNJ, ZWJ, BOM) are removed with the marks. They appear in copied Arabic text and would otherwise split tokens.
2. Step 5 treats every Unicode punctuation (P*), symbol (S*) and separator (Z*) character as a space, not just a fixed list.

Code points that are invisible or confusable are written as escapes or numbers, never literally. `scripts/escape-invisible.py --check` enforces this in CI, because formatters and editors can turn escapes into literal combining marks.

## Consequences
- Any change goes into the vectors file first, then both implementations.
- Unicode data versions differ slightly between Node and Python; a vector that exposes such a difference must pin the behaviour explicitly.
