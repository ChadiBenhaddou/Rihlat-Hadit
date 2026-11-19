import { describe, expect, it } from 'vitest';
import { assembleGraph, type LinkRow } from '../src/assemble';
import { depthFromSource, divergencePoints, filterRoutes, routeLength } from '../src/routes';

// TEST FIXTURE: placeholder ids. Routes 1 and 2 split at narrator 3; route 2 has an uncertain link.
function row(chainId: number, position: number, narratorId: number, extra: Partial<LinkRow> = {}): LinkRow {
  return {
    chainId,
    hadithNumber: chainId,
    routeNo: 1,
    terminus: 'prophet',
    isSuspended: false,
    chainCitationId: null,
    position,
    narratorId,
    mentionAr: '',
    termAr: null,
    linkKind: 'connected',
    slug: null,
    displayNameAr: `n${narratorId}`,
    honorificAr: null,
    role: narratorId === 9 ? 'prophet' : 'narrator',
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
const g = assembleGraph(
  [
    row(1, 0, 0),
    row(1, 1, 1),
    row(1, 2, 3),
    row(1, 3, 9),
    row(2, 0, 0),
    row(2, 1, 2, { linkKind: 'uncertain' }),
    row(2, 2, 3),
    row(2, 3, 9),
  ],
  { kind: 'group', groupId: 1 },
  'fixture',
  [],
);

describe('all-routes helpers', () => {
  it('finds where routes split', () => {
    expect(divergencePoints(g)).toEqual(['n:3']);
  });
  it('filters to the kept routes', () => {
    const sub = filterRoutes(g, (c) => c.id === 1);
    expect(sub.nodes.map((n) => n.id).sort()).toEqual(['n:0', 'n:1', 'n:3', 'n:9']);
    expect(sub.edges.every((e) => e.chainIds.length === 1)).toBe(true);
  });
  it('measures depth from the source and route length', () => {
    expect(depthFromSource(g).get('n:9')).toBe(0);
    expect(depthFromSource(g).get('n:0')).toBe(3);
    expect(routeLength(g, g.chains[0]!)).toBe(2);
  });
});
