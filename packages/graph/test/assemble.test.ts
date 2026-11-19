import { IsnadGraph } from '@isnad/shared';
import { describe, expect, it } from 'vitest';
import { assembleGraph, type LinkRow } from '../src/assemble';

// TEST FIXTURE: placeholder narrators, not content. Two routes converging on narrator 3.
function row(chainId: number, position: number, narratorId: number | null, extra: Partial<LinkRow> = {}): LinkRow {
  return {
    chainId,
    hadithNumber: 1,
    routeNo: chainId,
    terminus: 'prophet',
    isSuspended: false,
    chainCitationId: null,
    position,
    narratorId,
    mentionAr: `m${narratorId}`,
    termAr: 'حدثنا',
    linkKind: 'connected',
    slug: narratorId == null ? null : `r${narratorId}`,
    displayNameAr: narratorId == null ? null : `n${narratorId}`,
    honorificAr: null,
    role: narratorId === 9 ? 'prophet' : narratorId === 0 ? 'compiler' : 'narrator',
    tabaqa: null,
    birthAh: null,
    deathAh: null,
    deathAhMax: null,
    datesCitationId: null,
    summaryGradeAr: null,
    summaryGradeCitationId: null,
    reviewStatus: 'auto',
    ...extra,
  };
}

const rows: LinkRow[] = [
  row(1, 0, 0),
  row(1, 1, 1),
  row(1, 2, 3),
  row(1, 3, 4),
  row(1, 4, 9),
  row(2, 0, 0),
  row(2, 1, 2, { linkKind: 'suspended', termAr: 'وقال' }),
  row(2, 2, 3),
  row(2, 3, 4),
  row(2, 4, 9),
];

describe('assembleGraph', () => {
  const g = assembleGraph(rows, { kind: 'hadith', collection: 'bukhari', number: 1 }, 'fixture', []);

  it('satisfies the payload contract', () => {
    expect(() => IsnadGraph.parse(g)).not.toThrow();
  });

  it('merges a narrator shared by routes into one node', () => {
    expect(g.nodes.map((n) => n.id).sort()).toEqual(['n:0', 'n:1', 'n:2', 'n:3', 'n:4', 'n:9']);
    const shared = g.edges.find((e) => e.from === 'n:4' && e.to === 'n:3');
    expect(shared?.chainIds).toEqual([1, 2]);
  });

  it('points edges teacher → student and keeps a suspended link broken', () => {
    const e = g.edges.find((x) => x.from === 'n:2' && x.to === 'n:0');
    expect(e).toMatchObject({ kind: 'suspended', termAr: 'وقال' });
  });

  it('names the common link nearest al-Bukhari and counts layers from the source', () => {
    const madar = g.indicators.find((i) => i.key === 'common_link');
    expect(madar?.valueAr).toBe('n3');
    expect(g.indicators.find((i) => i.key === 'layer_counts')?.valueAr).toBe('1، 1، 1، 2، 1');
  });

  it('keeps unresolved mentions apart and never shows an uncited summary grade', () => {
    const g2 = assembleGraph(
      [row(5, 0, 0), row(5, 1, null, { mentionAr: 'رجل' }), row(5, 2, 7, { summaryGradeAr: 'ثقة' })],
      { kind: 'hadith', collection: 'bukhari', number: 2 },
      'fixture',
      [],
    );
    expect(g2.nodes.find((n) => n.id === 'u:5:1')).toMatchObject({ nameAr: 'رجل', role: 'unresolved' });
    expect(g2.nodes.find((n) => n.id === 'n:7')?.summaryGradeAr).toBeUndefined();
  });
});
