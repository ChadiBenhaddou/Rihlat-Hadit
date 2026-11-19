/** WCAG 2.2 AA contrast for every theme token pair (SPEC §11). */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('../../app/app.css', import.meta.url)), 'utf8');

function block(selector: string): Record<string, string> {
  const at = css.indexOf(selector);
  if (at < 0) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  const vars: Record<string, string> = {};
  for (const m of css.slice(open, close).matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) vars[m[1]!] = m[2]!;
  return vars;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const themes = {
  light: block(':root {'),
  darkOs: block(":root:not([data-theme='light']) {"),
  darkForced: block(":root[data-theme='dark'] {"),
};

/** Text needs 4.5:1; lines, focus rings and graph strokes need 3:1 (WCAG 1.4.3, 1.4.11). */
const pairs: Array<[string, number]> = [
  ['color-ink', 4.5],
  ['color-ink-muted', 4.5],
  ['color-accent', 4.5],
  ['color-line', 3],
  ['color-focus', 3],
  ...Array.from({ length: 8 }, (_, i) => [`tabaqa-${i + 1}`, 3] as [string, number]),
  ...Array.from({ length: 8 }, (_, i) => [`route-${i + 1}`, 3] as [string, number]),
];

describe.each(Object.entries(themes))('%s theme', (_name, t) => {
  it.each(['color-bg', 'color-surface'])('meets AA on %s', (bg) => {
    for (const [fg, min] of pairs) {
      expect(t[fg], `${fg} defined`).toBeDefined();
      expect(contrast(t[fg]!, t[bg]!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(min);
    }
  });
});

it('the two dark blocks agree', () => {
  expect(themes.darkOs).toEqual(themes.darkForced);
});
