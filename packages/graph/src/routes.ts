/** All-routes helpers (SPEC §12 ج). Pure functions over the graph payload. */
import type { IsnadGraph } from '@isnad/shared';

/** The subgraph used by the kept routes. Indicators are left as computed for the full set. */
export function filterRoutes(g: IsnadGraph, keep: (c: IsnadGraph['chains'][number]) => boolean): IsnadGraph {
  const chains = g.chains.filter(keep);
  const ids = new Set(chains.map((c) => c.id));
  const nodeIds = new Set(chains.flatMap((c) => c.nodeIds));
  const edges = g.edges
    .map((e) => ({ ...e, chainIds: e.chainIds.filter((id) => ids.has(id)) }))
    .filter((e) => e.chainIds.length > 0);
  return { ...g, chains, nodes: g.nodes.filter((n) => nodeIds.has(n.id)), edges };
}

/** Narrators from whom routes split toward different students (divergence points). */
export function divergencePoints(g: IsnadGraph): string[] {
  const students = new Map<string, Set<string>>();
  for (const e of g.edges) students.set(e.from, (students.get(e.from) ?? new Set()).add(e.to));
  return [...students].filter(([, s]) => s.size > 1).map(([id]) => id);
}

/** Depth of each node counted from the source (the Prophet ﷺ = 0), for growing routes downward. */
export function depthFromSource(g: IsnadGraph): Map<string, number> {
  const depth = new Map<string, number>();
  for (const c of g.chains) {
    const fromSource = [...c.nodeIds].reverse();
    fromSource.forEach((id, i) => depth.set(id, Math.min(depth.get(id) ?? i, i)));
  }
  return depth;
}

/** al-Bukhari's own teacher in each route (position 1). */
export function bukhariTeacher(c: IsnadGraph['chains'][number]): string | undefined {
  return c.nodeIds[1];
}

/** Narrators in a route, not counting al-Bukhari or the Prophet ﷺ. */
export function routeLength(g: IsnadGraph, c: IsnadGraph['chains'][number]): number {
  const prophet = new Set(g.nodes.filter((n) => n.role === 'prophet').map((n) => n.id));
  return c.nodeIds.slice(1).filter((id) => !prophet.has(id)).length;
}
