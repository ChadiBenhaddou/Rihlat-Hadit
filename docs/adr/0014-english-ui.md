# 0014 — English UI under /en, keyed by the Arabic strings

**Status:** Accepted · 2026-11-19

## Context
SPEC §11 makes the UI Arabic-first with an English UI from Phase 4, `hreflang` for `ar` and `en` (§15), and forbids inventing data (principle 4).

## Decision
- Public routes are mounted twice: at `/` and under `/en`, with distinct route ids. `<html lang dir>` follows the URL. The header links to the same page in the other language, and every public page emits `hreflang` alternates.
- UI strings go through `t()` from `app/i18n.ts`, keyed by the Arabic text; English lives in `app/i18n.en.ts`. A missing entry falls back to Arabic, and `test/node/i18n.test.ts` fails CI when any key lacks an English entry.
- **Source text is never translated or transliterated:** hadith text, narrator names, al-Bukhari's chapter titles and critics' statements stay in Arabic, marked `lang="ar" dir="rtl"`. The sources give no transliterations, and producing them would be invented data.
- Research indicators are computed in Arabic on the server and rendered in English by indicator key and known value patterns; names inside them stay Arabic.
- Directional controls follow reading direction: "next" is ← and ArrowLeft in Arabic, → and ArrowRight in English.
- The editorial tools stay Arabic-only.

## Consequences
- The English dictionary ships in the root bundle for both languages. A hadith page loads 175.1 KB gzip of JS against the 180 KB budget. If the budget tightens, pass the dictionary as root loader data on `/en` pages only.
