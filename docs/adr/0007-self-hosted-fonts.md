# 0007 — Self-hosted fonts through Fontsource

**Status:** Accepted · 2026-11-19

## Context
SPEC §11: Amiri or Scheherazade New for hadith text, IBM Plex Sans Arabic or Noto Sans Arabic for the UI, self-hosted WOFF2 subsets, no third-party font CDN, hadith font preloaded.

## Decision
Use `@fontsource/amiri` (400, 700) and `@fontsource/ibm-plex-sans-arabic` (400, 600, plus Latin 400), importing only the Arabic-subset CSS files. Vite copies the WOFF2 files into the Worker's static assets and fingerprints them. The root route preloads `amiri-arabic-400-normal.woff2`. All four candidate families are SIL OFL 1.1; Fontsource packages carry the licence files.

## Consequences
- No font request leaves our origin, so `font-src 'self'` holds.
- Fontsource's subsets are its own, not tuned to the hadith corpus. If the payload is too heavy, subset with `pyftsubset` against the loaded text in Phase 2.
