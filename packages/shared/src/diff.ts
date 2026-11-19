/**
 * Compare narrations (SPEC §12 هـ). Matns are diffed token by token on normalized
 * tokens, but the original tokens (with tashkeel) are what is shown. Chains are
 * aligned on their shared narrators by longest common subsequence.
 */
import { normalizeArabic } from './arabic';

export type DiffOp =
  | { op: 'same'; a: string; b: string }
  | { op: 'added'; b: string } // only in B
  | { op: 'omitted'; a: string } // only in A
  | { op: 'changed'; a: string; b: string };

/** Words of the original text, punctuation kept attached; empty tokens dropped. */
export function words(text: string): string[] {
  return text.split(/\s+/).filter((w) => normalizeArabic(w) !== '');
}

function lcsTable<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): number[][] {
  const t = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      t[i]![j] = eq(a[i]!, b[j]!) ? t[i + 1]![j + 1]! + 1 : Math.max(t[i + 1]![j]!, t[i]![j + 1]!);
  return t;
}

export function diffWords(aText: string, bText: string): DiffOp[] {
  const a = words(aText);
  const b = words(bText);
  const an = a.map(normalizeArabic);
  const bn = b.map(normalizeArabic);
  const t = lcsTable(an, bn, (x, y) => x === y);
  const raw: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (an[i] === bn[j]) raw.push({ op: 'same', a: a[i++]!, b: b[j++]! });
    else if (t[i + 1]![j]! >= t[i]![j + 1]!) raw.push({ op: 'omitted', a: a[i++]! });
    else raw.push({ op: 'added', b: b[j++]! });
  }
  while (i < a.length) raw.push({ op: 'omitted', a: a[i++]! });
  while (j < b.length) raw.push({ op: 'added', b: b[j++]! });
  // An omission directly followed by an addition is one changed word.
  const out: DiffOp[] = [];
  for (let k = 0; k < raw.length; k++) {
    const x = raw[k]!;
    const y = raw[k + 1];
    if (x.op === 'omitted' && y?.op === 'added') {
      out.push({ op: 'changed', a: x.a, b: y.b });
      k++;
    } else out.push(x);
  }
  return out;
}

/** Side-by-side chain rows aligned on shared narrator ids (null = no counterpart). */
export function alignChains<T>(a: T[], b: T[], key: (x: T) => string): [T | null, T | null][] {
  const t = lcsTable(a, b, (x, y) => key(x) === key(y));
  const rows: [T | null, T | null][] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (key(a[i]!) === key(b[j]!)) rows.push([a[i++]!, b[j++]!]);
    else if (t[i + 1]![j]! >= t[i]![j + 1]!) rows.push([a[i++]!, null]);
    else rows.push([null, b[j++]!]);
  }
  while (i < a.length) rows.push([a[i++]!, null]);
  while (j < b.length) rows.push([null, b[j++]!]);
  return rows;
}
