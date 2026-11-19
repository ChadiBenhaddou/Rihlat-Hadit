import type { IsnadGraph } from '@isnad/shared';

export interface Point {
  x: number;
  y: number;
}
export interface PlacedNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface PlacedEdge {
  key: string;
  from: string;
  to: string;
  points: Point[];
}
export interface Layout {
  width: number;
  height: number;
  nodes: Map<string, PlacedNode>;
  edges: PlacedEdge[];
}

export const NODE_HEIGHT = 52;

/** Width from the name's length; Arabic UI text at 15px averages about 8.5px per character. */
export function nodeWidth(name: string): number {
  return Math.max(120, Math.min(260, Math.round([...name].length * 8.5 + 32)));
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (r: { result?: ElkResult; error?: string }) => void>();

interface ElkResult {
  width: number;
  height: number;
  children: { id: string; x: number; y: number; width: number; height: number }[];
  edges: { id: string; sections?: { startPoint: Point; endPoint: Point; bendPoints?: Point[] }[] }[];
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; result?: ElkResult; error?: string }>) => {
      pending.get(e.data.id)?.(e.data);
      pending.delete(e.data.id);
    };
  }
  return worker;
}

export async function layoutGraph(g: IsnadGraph, labelOf: (id: string) => string): Promise<Layout> {
  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'POLYLINE',
      'elk.layered.spacing.nodeNodeBetweenLayers': '64',
      'elk.spacing.nodeNode': '28',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.padding': '[top=24,left=24,bottom=24,right=24]',
    },
    children: g.nodes.map((n) => ({ id: n.id, width: nodeWidth(labelOf(n.id)), height: NODE_HEIGHT })),
    edges: g.edges.map((e) => ({ id: `${e.from}>${e.to}`, sources: [e.from], targets: [e.to] })),
  };
  const id = ++seq;
  const out = await new Promise<{ result?: ElkResult; error?: string }>((resolve) => {
    pending.set(id, resolve);
    getWorker().postMessage({ id, graph: elkGraph });
  });
  if (!out.result) throw new Error(out.error ?? 'layout failed');
  const r = out.result;
  const nodes = new Map(r.children.map((c) => [c.id, { id: c.id, x: c.x, y: c.y, width: c.width, height: c.height }]));
  const edges = r.edges.map((e) => {
    const [from, to] = e.id.split('>') as [string, string];
    const s = e.sections?.[0];
    const points = s ? [s.startPoint, ...(s.bendPoints ?? []), s.endPoint] : [];
    return { key: e.id, from, to, points };
  });
  return { width: r.width, height: r.height, nodes, edges };
}

/**
 * Timeline layout (SPEC §12): the vertical axis is the death year in AH. Nodes keep
 * the layered layout's horizontal position. A narrator without a death year sits
 * between the chain neighbours that have one, marked undated, with no year
 * label: the layout never implies a date the sources do not give.
 */
export interface Timeline {
  layout: Layout;
  ticks: { year: number; y: number }[];
  undated: Set<string>;
  lifespans: Map<string, { y1: number; y2: number }>;
}

const PX_PER_YEAR = 3.2;
const TOP = 70;

export function toTimeline(base: Layout, g: IsnadGraph): Timeline {
  const years = g.nodes.flatMap((n) => (n.deathAh != null ? [n.deathAh] : []));
  const min = years.length ? Math.min(...years) : 0;
  const yOf = (year: number) => TOP + (year - min) * PX_PER_YEAR;
  const y = new Map<string, number>();
  for (const n of g.nodes) if (n.deathAh != null) y.set(n.id, yOf(n.deathAh));
  // The Prophet ﷺ sits above the earliest year: the source of every route.
  for (const n of g.nodes) if (n.role === 'prophet') y.set(n.id, 10);

  // Undated: midway between the nearest dated neighbours along any chain.
  const undated = new Set<string>();
  for (const n of g.nodes) {
    if (y.has(n.id)) continue;
    undated.add(n.id);
    const guesses: number[] = [];
    for (const c of g.chains) {
      const i = c.nodeIds.indexOf(n.id);
      if (i < 0) continue;
      const after = c.nodeIds
        .slice(0, i)
        .reverse()
        .find((id) => y.has(id)); // student side (later)
      const before = c.nodeIds.slice(i + 1).find((id) => y.has(id)); // teacher side (earlier)
      if (after && before) guesses.push((y.get(after)! + y.get(before)!) / 2);
      else if (after) guesses.push(y.get(after)! - 40);
      else if (before) guesses.push(y.get(before)! + 40);
    }
    y.set(n.id, guesses.length ? guesses.reduce((a, b) => a + b, 0) / guesses.length : TOP);
  }

  const nodes = new Map<string, PlacedNode>();
  for (const [id, p] of base.nodes) nodes.set(id, { ...p, y: y.get(id) ?? p.y });
  const edges = base.edges.map((e) => {
    const a = nodes.get(e.from)!;
    const b = nodes.get(e.to)!;
    const down = a.y <= b.y;
    return {
      ...e,
      points: [
        { x: a.x + a.width / 2, y: down ? a.y + a.height : a.y },
        { x: b.x + b.width / 2, y: down ? b.y : b.y + b.height },
      ],
    };
  });
  const lifespans = new Map<string, { y1: number; y2: number }>();
  for (const n of g.nodes) {
    if (n.birthAh != null && n.deathAh != null && !undated.has(n.id))
      lifespans.set(n.id, { y1: yOf(n.birthAh), y2: yOf(n.deathAh) });
  }
  const maxY = Math.max(...[...nodes.values()].map((p) => p.y + p.height), TOP) + 30;
  const ticks: { year: number; y: number }[] = [];
  if (years.length) {
    const max = Math.max(...years);
    for (let yr = Math.ceil(min / 25) * 25; yr <= max; yr += 25) ticks.push({ year: yr, y: yOf(yr) });
  }
  return { layout: { width: base.width + 60, height: maxY, nodes, edges }, ticks, undated, lifespans };
}
