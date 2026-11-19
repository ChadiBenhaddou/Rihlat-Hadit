import { describe, expect, it } from 'vitest';
import { assembleGraph, type LinkRow } from '../src/assemble';

// TEST FIXTURE: placeholder narrators and dates, not content.
function row(position: number, narratorId: number, extra: Partial<LinkRow> = {}): LinkRow {
  return {
    chainId: 1,
    hadithNumber: 1,
    routeNo: 1,
    terminus: 'prophet',
    isSuspended: false,
    chainCitationId: null,
    position,
    narratorId,
    mentionAr: `m${narratorId}`,
    termAr: 'حدثنا',
    linkKind: 'connected',
    slug: `r${narratorId}`,
    displayNameAr: `n${narratorId}`,
    honorificAr: null,
    role: narratorId === 9 ? 'prophet' : narratorId === 0 ? 'compiler' : 'narrator',
    tabaqa: null,
    birthAh: null,
    deathAh: null,
    deathAhMax: null,
    datesCitationId: 100 + narratorId,
    summaryGradeAr: null,
    summaryGradeCitationId: null,
    reviewStatus: 'auto',
    ...extra,
  };
}

const rows = [
  row(0, 0, { birthAh: 194, deathAh: 256 }),
  row(1, 1, { birthAh: 150, deathAh: 219 }), // teacher of 0: overlap 219 − 194 = 25
  row(2, 2, { deathAh: 140 }), // teacher of 1: 140 − 150 < 0 → no apparent overlap
  row(3, 3), // no dates → unavailable
  row(4, 9),
];
const places = new Map([
  [1, [{ nameAr: 'مكة', citationId: 7 }]],
  [
    0,
    [
      { nameAr: 'مكة', citationId: 8 },
      { nameAr: 'بخارى', citationId: 9 },
    ],
  ],
]);
const g = assembleGraph(rows, { kind: 'hadith', collection: 'bukhari', number: 1 }, 'fixture', [], places);
const ind = (k: string) => g.indicators.find((i) => i.key === k)!;

describe('contemporaneity', () => {
  it('compares the teacher death year with the student birth year, citing both', () => {
    const c = ind('contemporaneity');
    expect(c.inputs.map((i) => i.value)).toEqual([
      'تداخل نحو 25 سنة',
      'لا تداخل ظاهر بحسب التواريخ المتاحة',
      'غير متوفر',
    ]);
    expect(c.inputs[0]!.citationIds.sort()).toEqual([100, 101]);
    expect(c.valueAr).toBe('تداخل ظاهر: 1 · لا تداخل ظاهر: 1 · غير متوفر: 1');
  });
  it('does not measure links to the Prophet', () => {
    expect(ind('contemporaneity').inputs).toHaveLength(3);
  });
});

describe('shared places', () => {
  it('lists cities recorded for both, and treats missing data as nothing', () => {
    const p = ind('shared_places');
    expect(p.inputs[0]).toMatchObject({ value: 'مكة' });
    expect(p.inputs[0]!.citationIds.sort()).toEqual([7, 8]);
    expect(p.inputs[1]!.value).toBe('لا بلد مشترك مسجّل');
  });
});
