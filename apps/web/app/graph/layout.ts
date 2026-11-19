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
