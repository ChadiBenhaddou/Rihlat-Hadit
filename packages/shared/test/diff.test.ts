import { describe, expect, it } from 'vitest';
import { alignChains, diffWords } from '../src/diff';

// TEST FIXTURE wordings (placeholders, not content).
describe('diffWords', () => {
  it('ignores tashkeel and letter variants, keeps the original words', () => {
    const d = diffWords('إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ', 'إنما الاعمال بالنيات');
    expect(d.every((x) => x.op === 'same')).toBe(true);
    expect(d[0]).toEqual({ op: 'same', a: 'إِنَّمَا', b: 'إنما' });
  });
  it('marks additions, omissions and changed words', () => {
    const d = diffWords('أ ب ج د', 'أ ج هـ د و');
    expect(d).toEqual([
      { op: 'same', a: 'أ', b: 'أ' },
      { op: 'omitted', a: 'ب' },
      { op: 'same', a: 'ج', b: 'ج' },
      { op: 'added', b: 'هـ' },
      { op: 'same', a: 'د', b: 'د' },
      { op: 'added', b: 'و' },
    ]);
    expect(diffWords('أ ب ج', 'أ س ج')[1]).toEqual({ op: 'changed', a: 'ب', b: 'س' });
  });
});

describe('alignChains', () => {
  it('aligns shared narrators and leaves gaps elsewhere', () => {
    const rows = alignChains(['b', 'x', 'y', 'p'], ['b', 'z', 'y', 'p'], (s) => s);
    expect(rows).toEqual([
      ['b', 'b'],
      ['x', null],
      [null, 'z'],
      ['y', 'y'],
      ['p', 'p'],
    ]);
  });
});
