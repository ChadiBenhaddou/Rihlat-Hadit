/** Node ids of the graph payload (SPEC §10). */

export function resolvedNodeId(narratorId: number): string {
  return `n:${narratorId}`;
}

export function unresolvedNodeId(chainId: number, position: number): string {
  return `u:${chainId}:${position}`;
}

/** The node id for one chain link: resolved narrators merge across routes, unresolved mentions never do. */
export function nodeIdForLink(link: { chainId: number; position: number; narratorId: number | null }): string {
  return link.narratorId == null ? unresolvedNodeId(link.chainId, link.position) : resolvedNodeId(link.narratorId);
}
