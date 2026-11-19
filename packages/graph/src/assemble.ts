/**
 * Assemble the graph payload (SPEC §10) from chain-link rows. Pure: no I/O.
 *
 * A resolved narrator is one node however many routes pass through them;
 * that merge is what makes convergence visible. Unresolved mentions stay
 * one node per (chain, position).
 */
import type { GraphChain, GraphEdge, GraphNode, IsnadGraph, LinkKind, ReviewStatus, Terminus } from '@isnad/shared';
import { nodeIdForLink } from './ids';
import { computeIndicators, type PlacesByNarrator } from './indicators';

export interface LinkRow {
  chainId: number;
  hadithNumber: number;
  routeNo: number;
  terminus: Terminus;
  isSuspended: boolean;
  chainCitationId: number | null;
  position: number;
  narratorId: number | null;
  mentionAr: string;
  termAr: string | null;
  linkKind: LinkKind;
  // narrator columns (null for unresolved mentions)
  slug: string | null;
  displayNameAr: string | null;
  honorificAr: string | null;
  role: 'prophet' | 'companion' | 'narrator' | 'compiler' | null;
  tabaqa: number | null;
  birthAh: number | null;
  deathAh: number | null;
  deathAhMax: number | null;
  datesCitationId: number | null;
  summaryGradeAr: string | null;
  summaryGradeCitationId: number | null;
  reviewStatus: ReviewStatus | null;
}

export function assembleGraph(
  rows: LinkRow[],
  scope: IsnadGraph['scope'],
  dataVersion: string,
  citations: IsnadGraph['citations'],
  places: PlacesByNarrator = new Map(),
): IsnadGraph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const chains = new Map<number, GraphChain>();
  const byChain = new Map<number, LinkRow[]>();
  for (const r of rows) {
    const list = byChain.get(r.chainId) ?? [];
    list.push(r);
    byChain.set(r.chainId, list);
  }

  for (const [chainId, links] of byChain) {
    links.sort((a, b) => a.position - b.position);
    const first = links[0]!;
    const nodeIds: string[] = [];
    for (const l of links) {
      const id = nodeIdForLink(l);
      nodeIds.push(id);
      if (!nodes.has(id)) nodes.set(id, toNode(id, l));
    }
    // Teacher (position p + 1) → student (position p): the direction of transmission.
    for (let p = 0; p + 1 < links.length; p++) {
      const student = nodeIds[p]!;
      const teacher = nodeIds[p + 1]!;
      const link = links[p + 1]!;
      if (student === teacher) continue;
      const key = `${teacher}>${student}`;
      const e = edges.get(key);
      if (e) {
        if (!e.chainIds.includes(chainId)) e.chainIds.push(chainId);
        // A link drawn solid in one route but broken in another stays visibly broken.
        if (e.kind === 'connected' && link.linkKind !== 'connected') e.kind = link.linkKind;
        if (!e.termAr && link.termAr) e.termAr = link.termAr;
      } else {
        const edge: GraphEdge = { from: teacher, to: student, kind: link.linkKind, chainIds: [chainId] };
        if (link.termAr) edge.termAr = link.termAr;
        edges.set(key, edge);
      }
    }
    chains.set(chainId, {
      id: chainId,
      hadithNumber: first.hadithNumber,
      routeNo: first.routeNo,
      nodeIds,
      isSuspended: first.isSuspended,
      terminus: first.terminus,
    });
  }

  const graph: IsnadGraph = {
    dataVersion,
    scope,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    chains: [...chains.values()].sort((a, b) => a.hadithNumber - b.hadithNumber || a.routeNo - b.routeNo),
    indicators: [],
    citations,
  };
  graph.indicators = computeIndicators(graph, places);
  return graph;
}

function toNode(id: string, l: LinkRow): GraphNode {
  if (l.narratorId == null) {
    return { id, nameAr: l.mentionAr || 'راوٍ مبهم', role: 'unresolved', citationIds: [], reviewStatus: 'auto' };
  }
  const n: GraphNode = {
    id,
    narratorId: l.narratorId,
    nameAr: l.displayNameAr ?? l.mentionAr,
    role: l.role ?? 'narrator',
    citationIds: l.datesCitationId != null ? [l.datesCitationId] : [],
    reviewStatus: l.reviewStatus ?? 'auto',
  };
  if (l.slug) n.slug = l.slug;
  if (l.honorificAr) n.honorificAr = l.honorificAr;
  if (l.tabaqa != null) n.tabaqa = l.tabaqa;
  if (l.birthAh != null) n.birthAh = l.birthAh;
  if (l.deathAh != null) n.deathAh = l.deathAh;
  if (l.deathAhMax != null) n.deathAhMax = l.deathAhMax;
  // Decision 3: a summary grade is shown only with a citation attributing it.
  if (l.summaryGradeAr && l.summaryGradeCitationId != null) {
    n.summaryGradeAr = l.summaryGradeAr;
    n.citationIds.push(l.summaryGradeCitationId);
  }
  return n;
}
