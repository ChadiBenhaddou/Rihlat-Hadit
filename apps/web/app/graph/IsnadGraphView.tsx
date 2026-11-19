/**
 * The isnad graph (SPEC §12). Transmission flows top to bottom: the Prophet ﷺ
 * at the top, al-Bukhari at the bottom, which sidesteps left/right ambiguity on
 * an RTL page. Nodes are typographic only (principle 7). Link kind is encoded by
 * line style, never by colour alone: solid connected, dashed uncertain, dotted
 * and labelled for suspended or gap.
 */
import type { GraphNode, IsnadGraph } from '@isnad/shared';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import 'd3-transition';
import { useEffect, useMemo, useRef, useState } from 'react';
import { hijri } from '~/lib/format';
import { layoutGraph, toTimeline, type Layout, type Point, type Timeline } from './layout';

export interface GraphFocus {
  /** Nodes and edges the journey has reached; null = everything is shown normally. */
  visibleNodes: Set<string> | null;
  visibleEdges: Set<string> | null;
  activeNode: string | null;
  activeEdge: string | null;
}

export type LayoutMode = 'layered' | 'timeline';

interface Props {
  graph: IsnadGraph;
  focus: GraphFocus;
  hoverId: string | null;
  selectedId: string | null;
  /** Node ids in keyboard (Tab) order: the chosen route first. */
  tabOrder: string[];
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  reducedMotion: boolean;
  layoutMode?: LayoutMode;
  /** Highlight the common link with a ring (SPEC §12 ج). */
  ringIds?: string[];
  /** Divergence points: narrators from whom routes split. */
  markIds?: string[];
  /** Per-edge colour (all-routes view: one hue per route); line style still encodes kind. */
  edgeColor?: (key: string) => string | undefined;
  /** Clicking a link lists the entries that use it. */
  onSelectEdge?: (key: string) => void;
  selectedEdge?: string | null;
  /** Grow-in delay per node (ms): routes grow from the source downward. */
  growDelay?: Map<string, number>;
}

export function labelOf(n: GraphNode): string {
  return n.honorificAr ? `${n.nameAr} ${n.honorificAr}` : n.nameAr;
}

function tabaqaVar(t: number | undefined): string {
  if (t == null) return 'var(--color-line)';
  return `var(--tabaqa-${Math.min(8, Math.max(1, Math.ceil((t * 8) / 12)))})`;
}

function polyline(points: Point[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function midpoint(points: Point[]): Point {
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 };
  const segs = points.slice(1).map((p, i) => Math.hypot(p.x - points[i]!.x, p.y - points[i]!.y));
  let half = segs.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < segs.length; i++) {
    if (half <= segs[i]!) {
      const t = half / (segs[i]! || 1);
      const a = points[i]!;
      const b = points[i + 1]!;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    half -= segs[i]!;
  }
  return points[points.length - 1]!;
}

const KIND_AR: Record<string, string> = { suspended: 'تعليق', gap: 'انقطاع', uncertain: 'غير مؤكد' };

export function IsnadGraphView({
  graph,
  focus,
  hoverId,
  selectedId,
  tabOrder,
  onHover,
  onSelect,
  reducedMotion,
  layoutMode = 'layered',
  ringIds = [],
  markIds = [],
  edgeColor,
  onSelectEdge,
  selectedEdge = null,
  growDelay,
}: Props) {
  const [base, setBase] = useState<Layout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const edgeByKey = useMemo(() => new Map(graph.edges.map((e) => [`${e.from}>${e.to}`, e])), [graph]);

  useEffect(() => {
    let live = true;
    setBase(null);
    layoutGraph(graph, (id) => labelOf(byId.get(id)!))
      .then((l) => live && setBase(l))
      .catch((e: unknown) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, [graph, byId]);

  const timeline: Timeline | null = useMemo(
    () => (base && layoutMode === 'timeline' ? toTimeline(base, graph) : null),
    [base, layoutMode, graph],
  );
  const layout = timeline?.layout ?? base;

  // Pan and zoom; refit whenever the layout changes.
  useEffect(() => {
    if (!layout || !svgRef.current || !gRef.current) return;
    const svg = select(svgRef.current);
    const g = select(gRef.current);
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 2.5])
      .on('zoom', (e) => g.attr('transform', e.transform.toString()));
    zoomRef.current = z;
    svg.call(z);
    const { width, height } = svgRef.current.getBoundingClientRect();
    const k = Math.min(1, width / (layout.width || 1), height / (layout.height || 1));
    svg.call(
      z.transform,
      zoomIdentity.translate((width - layout.width * k) / 2, Math.max(0, (height - layout.height * k) / 2)).scale(k),
    );
    return () => {
      svg.on('.zoom', null);
    };
  }, [layout]);

  // Keep the active pair centred (500 ms).
  useEffect(() => {
    if (!layout || !svgRef.current || !zoomRef.current || !focus.activeNode) return;
    const ids = [focus.activeNode, ...(focus.activeEdge?.split('>') ?? [])];
    const boxes = ids.map((id) => layout.nodes.get(id)).filter((b): b is NonNullable<typeof b> => Boolean(b));
    if (!boxes.length) return;
    const minX = Math.min(...boxes.map((b) => b.x));
    const maxX = Math.max(...boxes.map((b) => b.x + b.width));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxY = Math.max(...boxes.map((b) => b.y + b.height));
    const { width, height } = svgRef.current.getBoundingClientRect();
    const k = Math.max(0.6, Math.min(1.4, width / (maxX - minX + 240), height / (maxY - minY + 200)));
    const t = zoomIdentity
      .translate(width / 2 - ((minX + maxX) / 2) * k, height / 2 - ((minY + maxY) / 2) * k)
      .scale(k);
    const svg = select(svgRef.current);
    if (reducedMotion) svg.call(zoomRef.current.transform, t);
    else svg.transition().duration(500).call(zoomRef.current.transform, t);
  }, [focus.activeNode, focus.activeEdge, layout, reducedMotion]);

  if (error) return <p className="p-4 text-ink-muted">تعذّر رسم المخطط. القائمة النصية أدناه تعرض الإسناد نفسه.</p>;

  const dimmed = (id: string) => focus.visibleNodes != null && !focus.visibleNodes.has(id);
  const order = [...tabOrder, ...graph.nodes.map((n) => n.id).filter((id) => !tabOrder.includes(id))];
  const grow = (id: string) =>
    growDelay && !reducedMotion && growDelay.has(id) ? { animationDelay: `${growDelay.get(id)}ms` } : undefined;

  return (
    <div className="relative h-full min-h-[24rem] w-full">
      {!layout && <div className="absolute inset-0 grid place-items-center text-ink-muted">جارٍ رسم المخطط…</div>}
      <svg ref={svgRef} className="h-full w-full touch-none select-none" role="group" aria-label="مخطط الإسناد">
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--color-line)" />
          </marker>
        </defs>
        <g ref={gRef}>
          {timeline && (
            <g className="timeline-axis" aria-hidden>
              {timeline.ticks.map((t) => (
                <g key={t.year} transform={`translate(0,${t.y})`}>
                  <line x1={0} x2={layout!.width} stroke="var(--color-hairline)" />
                  <text x={layout!.width - 4} y={-4} textAnchor="end" className="graph-meta">
                    {t.year} هـ
                  </text>
                </g>
              ))}
            </g>
          )}
          {layout?.edges.map((le) => {
            const e = edgeByKey.get(le.key);
            if (!e || le.points.length < 2) return null;
            const isDim = focus.visibleEdges != null && !focus.visibleEdges.has(le.key);
            const isActive = focus.activeEdge === le.key;
            const hot = (hoverId != null && (e.from === hoverId || e.to === hoverId)) || selectedEdge === le.key;
            const width = 1.5 + Math.min(4, e.chainIds.length - 1) * 0.75;
            const dash =
              e.kind === 'uncertain' ? '8 6' : e.kind === 'suspended' || e.kind === 'gap' ? '1 7' : undefined;
            const mid = midpoint(le.points);
            const label = [e.termAr, KIND_AR[e.kind]].filter(Boolean).join(' · ');
            const color = hot ? 'var(--color-accent)' : (edgeColor?.(le.key) ?? 'var(--color-line)');
            const d = polyline(le.points);
            return (
              <g
                key={le.key}
                className={`graph-edge${grow(e.from) ? ' grow-in' : ''}`}
                style={grow(e.from)}
                opacity={isDim ? 0.15 : 1}
              >
                <path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={width}
                  strokeDasharray={dash}
                  strokeLinecap="round"
                  markerEnd="url(#arrow)"
                />
                {onSelectEdge && (
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14}
                    className="cursor-pointer"
                    onClick={() => onSelectEdge(le.key)}
                    aria-hidden
                  />
                )}
                {isActive && !reducedMotion && (
                  <path
                    key={`draw-${le.key}`}
                    d={d}
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth={width + 1.5}
                    pathLength={1}
                    className="journey-draw"
                  />
                )}
                {label && layoutMode === 'layered' && (
                  <g
                    className={isActive && !reducedMotion ? 'journey-term' : undefined}
                    transform={`translate(${mid.x},${mid.y})`}
                  >
                    <rect
                      x={-label.length * 3.6 - 8}
                      y={-11}
                      width={label.length * 7.2 + 16}
                      height={22}
                      rx={6}
                      className="fill-[var(--color-bg)]"
                    />
                    <text textAnchor="middle" dominantBaseline="central" className="graph-term">
                      {label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          {layout &&
            order.map((id) => {
              const n = byId.get(id);
              const p = layout.nodes.get(id);
              if (!n || !p) return null;
              const active = focus.activeNode === id;
              const sel = selectedId === id;
              const hot = hoverId === id;
              const undated = timeline?.undated.has(id) ?? false;
              const meta =
                n.role === 'prophet'
                  ? ''
                  : n.role === 'unresolved'
                    ? 'اسم مبهم'
                    : undated
                      ? '' // the timeline never shows a year the sources do not give
                      : (hijri(n.deathAh, n.deathAhMax, 'ت ')?.replace(/ \(.*\)$/, '') ?? 'سنة الوفاة غير متوفرة');
              const life = timeline?.lifespans.get(id);
              return (
                <g
                  key={id}
                  transform={`translate(${p.x},${p.y})`}
                  className={`graph-node${active && !reducedMotion ? ' journey-node' : ''}${grow(id) ? ' grow-in' : ''}`}
                  style={grow(id)}
                  opacity={dimmed(id) ? 0.15 : 1}
                  tabIndex={0}
                  role="button"
                  aria-pressed={sel}
                  aria-label={`${labelOf(n)}${meta ? `، ${meta}` : undated ? '، سنة الوفاة غير متوفرة' : ''}`}
                  onMouseEnter={() => onHover(id)}
                  onMouseLeave={() => onHover(null)}
                  onFocus={() => onHover(id)}
                  onBlur={() => onHover(null)}
                  onClick={() => onSelect(id)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter') {
                      ev.preventDefault();
                      onSelect(id);
                    }
                  }}
                >
                  {undated && <title>سنة الوفاة غير متوفرة</title>}
                  {life && (
                    <rect
                      x={p.width / 2 - 1}
                      y={life.y1 - p.y}
                      width={2}
                      height={Math.max(2, life.y2 - life.y1)}
                      rx={1}
                      className="lifespan"
                    >
                      <title>{`عاش نحو ${hijri(n.birthAh, null) ?? ''} – ${hijri(n.deathAh, n.deathAhMax) ?? ''}`}</title>
                    </rect>
                  )}
                  {(ringIds.includes(id) || n.role === 'prophet') && (
                    <rect
                      x={-5}
                      y={-5}
                      width={p.width + 10}
                      height={p.height + 10}
                      rx={14}
                      fill="none"
                      stroke="var(--color-accent)"
                      strokeWidth={1.5}
                    />
                  )}
                  <rect
                    width={p.width}
                    height={p.height}
                    rx={10}
                    fill="var(--color-surface)"
                    stroke={sel || hot || active ? 'var(--color-accent)' : tabaqaVar(n.tabaqa)}
                    strokeWidth={sel || active ? 3 : 2}
                    strokeDasharray={
                      n.role === 'unresolved' || undated || (n.deathAh == null && n.role !== 'prophet')
                        ? '5 4'
                        : undefined
                    }
                  />
                  <text
                    x={p.width / 2}
                    y={meta ? 21 : p.height / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="graph-name"
                  >
                    {labelOf(n)}
                  </text>
                  {meta && (
                    <text x={p.width / 2} y={39} textAnchor="middle" dominantBaseline="central" className="graph-meta">
                      {meta}
                    </text>
                  )}
                  {ringIds.includes(id) && (
                    <text x={p.width / 2} y={-12} textAnchor="middle" className="graph-flag">
                      المدار
                    </text>
                  )}
                  {markIds.includes(id) && !ringIds.includes(id) && (
                    <text x={p.width / 2} y={p.height + 14} textAnchor="middle" className="graph-flag">
                      تفرّع
                    </text>
                  )}
                </g>
              );
            })}
        </g>
      </svg>
    </div>
  );
}
