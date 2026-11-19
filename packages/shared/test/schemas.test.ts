import { describe, expect, it } from 'vitest';
import { IsnadGraph, NodeId } from '../src/schemas';

// TEST FIXTURE — structural only. Names are placeholders, not content.
const minimal = {
  dataVersion: 'fixture-0',
  scope: { kind: 'hadith', collection: 'bukhari', number: 1 },
  nodes: [
    { id: 'n:1', nameAr: 'fixture-compiler', role: 'compiler', citationIds: [], reviewStatus: 'auto' },
    { id: 'u:10:1', nameAr: 'fixture-mention', role: 'unresolved', citationIds: [], reviewStatus: 'auto' },
  ],
  edges: [{ from: 'u:10:1', to: 'n:1', termAr: 'حدثنا', kind: 'connected', chainIds: [10] }],
  chains: [{ id: 10, hadithNumber: 1, routeNo: 1, nodeIds: ['n:1', 'u:10:1'], isSuspended: false, terminus: 'other' }],
  indicators: [],
  citations: [],
};

describe('IsnadGraph contract', () => {
  it('accepts a minimal payload', () => {
    expect(IsnadGraph.parse(minimal)).toEqual(minimal);
  });
  it('rejects an edge with no chain', () => {
    const bad = { ...minimal, edges: [{ ...minimal.edges[0], chainIds: [] }] };
    expect(IsnadGraph.safeParse(bad).success).toBe(false);
  });
  it('validates node ids', () => {
    expect(NodeId.safeParse('n:12').success).toBe(true);
    expect(NodeId.safeParse('u:3:4').success).toBe(true);
    expect(NodeId.safeParse('x:1').success).toBe(false);
  });
});
