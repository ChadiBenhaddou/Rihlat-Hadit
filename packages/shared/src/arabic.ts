/**
 * Arabic normalizer and light stemmer (SPEC §9).
 *
 * TypeScript twin of `pipeline/normalize/__init__.py`. Both must pass
 * `fixtures/normalization-cases.json`; change them together.
 *
 * Normalized text is for matching only. Never display it.
 */

/** Step 2: tashkeel and Quranic marks, tatweel; plus format (bidi, zero-width) characters. */
const MARKS = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]|\p{Cf}/gu;

/** Step 3: letter variants, as code points (mirrors the Python table). */
const FOLD_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [0x0623, 0x0627], // alef with hamza above → alef
  [0x0625, 0x0627], // alef with hamza below → alef
  [0x0622, 0x0627], // alef with madda → alef
  [0x0671, 0x0627], // alef wasla → alef
  [0x0649, 0x064a], // alef maqsura → ya
  [0x0629, 0x0647], // taa marbuta → ha
  [0x0624, 0x0648], // waw with hamza → waw
  [0x0626, 0x064a], // ya with hamza → ya
  [0x06a9, 0x0643], // Persian kaf → kaf
  [0x06cc, 0x064a], // Persian ya → ya
];
const FOLD = new Map(FOLD_PAIRS.map(([from, to]) => [String.fromCharCode(from), String.fromCharCode(to)]));
const FOLD_RE = new RegExp(`[${[...FOLD.keys()].join('')}]`, 'g');

/** Step 4: Arabic-Indic (U+0660–9) and Extended Arabic-Indic (U+06F0–9) digits. */
const DIGITS_RE = /[\u0660-\u0669\u06F0-\u06F9]/g;

/** Step 5: punctuation, symbols and whitespace become one space. */
const SEPARATORS = /[\p{P}\p{S}\p{Z}\s]+/gu;

/** Longest first (SPEC §9). */
export const PROCLITICS = ['وال', 'بال', 'كال', 'فال', 'لل', 'ال', 'و'] as const;
export const PROTECTED: ReadonlySet<string> = new Set(['الله', 'اللهم']);
const MIN_STEM = 3;

export function normalizeArabic(text: string): string {
  return text
    .normalize('NFKC')
    .replace(MARKS, '')
    .replace(FOLD_RE, (c) => FOLD.get(c) ?? c)
    .replace(DIGITS_RE, (c) => String(c.charCodeAt(0) & 0xf))
    .replace(SEPARATORS, ' ')
    .trim();
}

/** Strip one proclitic from an already normalized token, keeping at least 3 letters. */
export function stemArabic(token: string): string {
  if (PROTECTED.has(token)) return token;
  for (const p of PROCLITICS) {
    if (token.startsWith(p) && [...token].length - [...p].length >= MIN_STEM) {
      return token.slice(p.length);
    }
  }
  return token;
}

export function tokenizeArabic(text: string): string[] {
  const n = normalizeArabic(text);
  return n === '' ? [] : n.split(' ');
}

/** Surface and stem tokens, as stored in the FTS5 `surface` and `stem` columns. */
export function analyzeArabic(text: string): { surface: string[]; stem: string[] } {
  const surface = tokenizeArabic(text);
  return { surface, stem: surface.map(stemArabic) };
}
