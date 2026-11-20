/**
 * Narrator network (SPEC §12 د): Sigma.js on graphology, WebGL. Starts from one
 * narrator's ego network (depth 1), expands hop by hop on request, and never holds
 * more than 500 nodes. Layouts: ForceAtlas2 in a Web Worker, or layered by tabaqa.
 * Choosing two narrators lists the entries where they are adjacent in a chain.
 * Loaded lazily: none of this is in a page's initial JavaScript.
 */
import type { NetworkResponse, SharedResponse } from '@isnad/shared';
import Graph from 'graphology';
import FA2Layout from 'graphology-layout-forceatlas2/worker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import Sigma from 'sigma';
import { hijri } from '~/lib/format';
import { useI18n } from '~/i18n';

const CAP = 500;

type NodeAttrs = {
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
  tabaqa: number | null;
  deathAh: number | null;
  degree: number;
};

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888888';
}

/**
 * Labels are drawn with Canvas 2D on an overlay, not by Sigma's WebGL glyph atlas:
 * the atlas renders letters one by one and so cannot join Arabic script, while
 * Canvas 2D shapes text like the rest of the page.
 */
function drawLabels(sigma: Sigma<NodeAttrs>, canvas: HTMLCanvasElement, pinned: (string | null)[]): void {
  const g = sigma.getGraph();
  const { width, height } = sigma.getDimensions();
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-ui').trim() || 'sans-serif';
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const ink = cssVar('--color-ink');
  const halo = cssVar('--color-bg');
  const keep = new Set(pinned.filter((x): x is string => Boolean(x)));
  const order = g
    .nodes()
    .sort(
      (a, b) =>
        Number(keep.has(b)) - Number(keep.has(a)) || g.getNodeAttribute(b, 'degree') - g.getNodeAttribute(a, 'degree'),
    );
  const taken: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const id of order) {
    const d = sigma.getNodeDisplayData(id);
    if (!d) continue;
    const r = sigma.scaleSize(d.size);
    // Small nodes stay unlabelled unless pinned, as Sigma's own density rule did.
    if (!keep.has(id) && r < 5) continue;
    // Display data is in framed (normalized) coordinates; convert with the framed variant.
    const p = sigma.framedGraphToViewport({ x: d.x, y: d.y });
    if (p.x < -50 || p.y < -20 || p.x > width + 200 || p.y > height + 20) continue;
    const pin = keep.has(id);
    ctx.font = `${pin ? 600 : 400} ${pin ? 14 : 13}px ${family}`;
    const label = g.getNodeAttribute(id, 'label');
    const w = ctx.measureText(label).width;
    // In RTL the label sits at the start side (left of the node), ending just before it.
    const right = p.x - r - 4;
    const box = { x1: right - w - 2, y1: p.y - 9, x2: right + 2, y2: p.y + 9 };
    if (!pin && taken.some((b) => box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1)) continue;
    taken.push(box);
    ctx.lineWidth = 4;
    ctx.strokeStyle = halo;
    ctx.strokeText(label, right, p.y);
    ctx.fillStyle = ink;
    ctx.fillText(label, right, p.y);
  }
}

function tabaqaColor(t: number | null): string {
  if (t == null) return cssVar('--color-line');
  return cssVar(`--tabaqa-${Math.min(8, Math.max(1, Math.ceil((t * 8) / 12)))}`);
}

/** Layered by tabaqa: earlier generations above, spread evenly within a row. */
function tabaqaLayout(g: Graph<NodeAttrs>) {
  const rows = new Map<number, string[]>();
  g.forEachNode((id, a) => {
    const r = a.tabaqa ?? 13;
    rows.set(r, [...(rows.get(r) ?? []), id]);
  });
  for (const [r, ids] of rows) {
    ids.sort((x, y) => g.getNodeAttribute(y, 'degree') - g.getNodeAttribute(x, 'degree'));
    ids.forEach((id, i) => {
      g.setNodeAttribute(id, 'x', (i - (ids.length - 1) / 2) * 1.2);
      g.setNodeAttribute(id, 'y', -r * 4);
    });
  }
}

export default function NetworkView({
  center,
  centerName,
  dataVersion,
  layoutMode,
  onLayoutMode,
}: {
  center: string;
  centerName: string;
  dataVersion: string;
  layoutMode: 'fa2' | 'tabaqa';
  onLayoutMode: (m: 'fa2' | 'tabaqa') => void;
}) {
  const { t, to, locale } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const labelCanvas = useRef<HTMLCanvasElement>(null);
  const pinnedRef = useRef<(string | null)[]>([center]);
  const graphRef = useRef<Graph<NodeAttrs> | null>(null);
  const sigmaRef = useRef<Sigma<NodeAttrs> | null>(null);
  const fa2Ref = useRef<FA2Layout | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [anchor, setAnchor] = useState(center);
  const [size, setSize] = useState(0);
  const [capped, setCapped] = useState(false);
  const [busy, setBusy] = useState(true);
  const [shared, setShared] = useState<SharedResponse | null>(null);
  const expanded = useRef(new Set<string>());

  const api = <T,>(path: string): Promise<T> =>
    fetch(`/api/v1/d/${encodeURIComponent(dataVersion)}${path}`).then((r) =>
      r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
    );

  const runLayout = useCallback(() => {
    const g = graphRef.current;
    if (!g) return;
    fa2Ref.current?.kill();
    fa2Ref.current = null;
    if (layoutMode === 'tabaqa') {
      tabaqaLayout(g);
      return;
    }
    const fa2 = new FA2Layout(g, {
      settings: { gravity: 1, scalingRatio: 8, slowDown: 2, barnesHutOptimize: g.order > 200 },
    });
    fa2Ref.current = fa2;
    fa2.start();
    setTimeout(() => fa2.stop(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 400 : 2500);
  }, [layoutMode]);

  const merge = useCallback(
    (net: NetworkResponse, near?: string) => {
      const g = graphRef.current!;
      const origin = near && g.hasNode(near) ? g.getNodeAttributes(near) : { x: 0, y: 0 };
      let added = 0;
      for (const n of net.nodes) {
        if (g.hasNode(n.slug)) continue;
        if (g.order >= CAP) {
          setCapped(true);
          break;
        }
        g.addNode(n.slug, {
          label: n.nameAr,
          x: origin.x + (Math.random() - 0.5) * 4,
          y: origin.y + (Math.random() - 0.5) * 4,
          size: 4,
          color: tabaqaColor(n.tabaqa),
          tabaqa: n.tabaqa,
          deathAh: n.deathAh,
          degree: 0,
        });
        added++;
      }
      for (const e of net.edges) {
        if (g.hasNode(e.teacher) && g.hasNode(e.student) && !g.hasEdge(e.teacher, e.student)) {
          g.addDirectedEdge(e.teacher, e.student, {
            size: Math.min(6, 0.6 + Math.log2(1 + e.count)),
            color: cssVar('--color-hairline'),
            count: e.count,
          });
        }
      }
      g.forEachNode((id) => {
        const d = g.degree(id);
        g.mergeNodeAttributes(id, { degree: d, size: id === center ? 12 : Math.min(11, 3 + Math.sqrt(d) * 1.4) });
      });
      setSize(g.order);
      return added;
    },
    [center],
  );

  // Build once per centre.
  useEffect(() => {
    if (!box.current) return;
    const g = new Graph<NodeAttrs>({ type: 'directed', multi: false });
    graphRef.current = g;
    expanded.current = new Set([center]);
    setSelected(null);
    setAnchor(center);
    setCapped(false);
    setBusy(true);
    let live = true;
    let sigma: Sigma<NodeAttrs> | null = null;
    api<NetworkResponse>(`/narrators/${center}/network?depth=1&limit=200`)
      .then((net: NetworkResponse) => {
        if (!live || !box.current) return;
        merge(net);
        const instance = new Sigma(g, box.current, {
          settings: {
            renderLabels: false, // drawn by drawLabels() on the Canvas 2D overlay
            renderEdgeLabels: false,
            zIndex: true,
          } as never,
        });
        instance.on('afterRender', () => {
          if (labelCanvas.current) drawLabels(instance, labelCanvas.current, pinnedRef.current);
        });
        sigma = instance;
        sigmaRef.current = instance;
        instance.on('clickNode', ({ node }) => setSelected(node));
        instance.on('clickStage', () => setSelected(null));
        runLayout();
        setBusy(false);
      })
      .catch(() => live && setBusy(false));
    return () => {
      live = false;
      fa2Ref.current?.kill();
      fa2Ref.current = null;
      sigma?.kill();
      sigmaRef.current = null;
    };
  }, [center]);

  useEffect(() => {
    if (sigmaRef.current) runLayout();
  }, [runLayout]);

  // Highlight the selection and its neighbours.
  useEffect(() => {
    const g = graphRef.current;
    const s = sigmaRef.current;
    if (!g || !s) return;
    pinnedRef.current = [center, anchor, selected];
    const ink = cssVar('--color-accent');
    g.forEachNode((id, a) =>
      g.setNodeAttribute(id, 'color', id === selected || id === anchor ? ink : tabaqaColor(a.tabaqa)),
    );
    g.forEachEdge((e, _a, src, dst) =>
      g.setEdgeAttribute(
        e,
        'color',
        selected && (src === selected || dst === selected) ? ink : cssVar('--color-hairline'),
      ),
    );
    s.refresh();
  }, [selected, anchor, size]);

  // Entries where the anchor and the selection are adjacent in a chain.
  useEffect(() => {
    setShared(null);
    if (!selected || selected === anchor) return;
    api<SharedResponse>(`/narrators/${anchor}/shared/${selected}`)
      .then(setShared)
      .catch(() => setShared(null));
  }, [selected, anchor]);

  async function expand(slug: string) {
    if (expanded.current.has(slug) || (graphRef.current?.order ?? 0) >= CAP) return;
    expanded.current.add(slug);
    setBusy(true);
    try {
      const net = await api<NetworkResponse>(`/narrators/${slug}/network?depth=1&limit=60`);
      merge(net, slug);
      runLayout();
    } finally {
      setBusy(false);
    }
  }

  const sel = selected && graphRef.current?.hasNode(selected) ? graphRef.current.getNodeAttributes(selected) : null;
  const anchorName = graphRef.current?.hasNode(anchor)
    ? graphRef.current.getNodeAttribute(anchor, 'label')
    : centerName;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="inline-flex rounded-md border border-hairline" role="radiogroup" aria-label={t('تخطيط الشبكة')}>
          <button
            role="radio"
            aria-checked={layoutMode === 'fa2'}
            className={`seg${layoutMode === 'fa2' ? ' seg-on' : ''}`}
            onClick={() => onLayoutMode('fa2')}
          >
            {t('قوى')}
          </button>
          <button
            role="radio"
            aria-checked={layoutMode === 'tabaqa'}
            className={`seg${layoutMode === 'tabaqa' ? ' seg-on' : ''}`}
            onClick={() => onLayoutMode('tabaqa')}
          >
            {t('حسب الطبقة')}
          </button>
        </div>
        <span className="text-ink-muted" role="status">
          {busy ? t('جارٍ التحميل…') : `${t('{n} راويًا', { n: size })}${capped ? t(' — بلغ الحد الأقصى (500)') : ''}`}
        </span>
      </div>
      <div className="relative">
        <div
          ref={box}
          className="network-canvas"
          aria-label={t('شبكة شيوخ {name} وتلاميذه', { name: centerName })}
          role="img"
        />
        <canvas ref={labelCanvas} className="pointer-events-none absolute start-0 top-0" aria-hidden />
      </div>
      <p className="text-xs text-ink-muted">
        {t(
          t(
            'حجم الدائرة بعدد الروابط، ولونها بالطبقة، وسُمك الخط بعدد أحاديث الصحيح التي يرد فيها الرابط. القوائم النصية للشيوخ والتلاميذ أعلى الصفحة.',
          ),
        )}
      </p>
      {sel && selected && (
        <div className="summary space-y-2" role="region" aria-label={t('الراوي المختار')}>
          <div className="font-semibold">{sel.label}</div>
          <div className="text-sm text-ink-muted">
            {[
              hijri(sel.deathAh, null, t('ت '), locale) ?? t('سنة الوفاة غير متوفرة'),
              sel.tabaqa != null ? t('الطبقة {n}', { n: sel.tabaqa }) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn text-sm"
              onClick={() => void expand(selected)}
              disabled={expanded.current.has(selected) || size >= CAP}
            >
              {expanded.current.has(selected) ? t('موسَّع') : t('توسيع شيوخه وتلاميذه')}
            </button>
            {selected !== anchor && (
              <button className="btn text-sm" onClick={() => setAnchor(selected)}>
                {t('اجعله نقطة المقارنة')}
              </button>
            )}
            <Link className="btn text-sm" to={to(`/narrator/${selected}`)}>
              {t('صفحة الراوي')}
            </Link>
          </div>
          {selected !== anchor && (
            <div className="text-sm">
              <div className="font-semibold">
                مواضع يتجاور فيها {anchorName} {t('و')}
                {sel.label} في الإسناد
              </div>
              {!shared ? (
                <span className="text-ink-muted">{t('جارٍ البحث…')}</span>
              ) : shared.numbers.length === 0 ? (
                <span className="text-ink-muted">{t('لا مواضع متجاورة في الصحيح المحمَّل.')}</span>
              ) : (
                <ul className="mt-1 flex flex-wrap gap-2">
                  {shared.numbers.map((n) => (
                    <li key={n}>
                      <Link className="chip tabular-nums" to={to(`/bukhari/${n}`)}>
                        {n}
                      </Link>
                    </li>
                  ))}
                  {shared.nextCursor && <li className="text-ink-muted">{t('وغيرها…')}</li>}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
