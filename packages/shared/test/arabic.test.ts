import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analyzeArabic, normalizeArabic, stemArabic } from '../src/arabic';

interface Cases {
  normalize: { note: string; input: string; expected: string }[];
  stem: { note: string; input: string; expected: string }[];
  analyze: { note: string; input: string; surface: string[]; stem: string[] }[];
}

const cases: Cases = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../fixtures/normalization-cases.json', import.meta.url)), 'utf8'),
);

describe('normalizeArabic (shared vectors)', () => {
  it.each(cases.normalize)('$note', ({ input, expected }) => {
    expect(normalizeArabic(input)).toBe(expected);
  });
  it('is idempotent on every vector', () => {
    for (const { input } of cases.normalize) {
      const once = normalizeArabic(input);
      expect(normalizeArabic(once)).toBe(once);
    }
  });
});

describe('stemArabic (shared vectors)', () => {
  it.each(cases.stem)('$note', ({ input, expected }) => {
    expect(stemArabic(input)).toBe(expected);
  });
});

describe('analyzeArabic (shared vectors)', () => {
  it.each(cases.analyze)('$note', ({ input, surface, stem }) => {
    expect(analyzeArabic(input)).toEqual({ surface, stem });
  });
});
