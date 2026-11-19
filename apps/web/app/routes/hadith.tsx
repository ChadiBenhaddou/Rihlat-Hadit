/**
 * The three-pane hadith page (SPEC §11): hadith text at the start (right in
 * RTL), the isnad graph in the middle, the narrator pane at the end. View state
 * lives in the query string: ?route=&mode=journey&dir=trace&step=&node=
 */
import * as Dialog from '@radix-ui/react-dialog';
import type { IsnadGraph } from '@isnad/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Cite } from '~/components/Cite';
import { HadithText } from '~/components/HadithText';
import { NarratorCard } from '~/components/NarratorCard';
import { ReviewBadge } from '~/components/ReviewBadge';
import { IsnadGraphView, labelOf, type GraphFocus } from '~/graph/IsnadGraphView';
import { journeyOrder, readJourney, STEP_MS, type JourneyState } from '~/graph/journey';
import { dataContext, notFound } from '~/lib/data.server';
import { TERMINUS_AR } from '~/lib/format';
import { getHadith } from '../../server/data/hadith';
import type { Route } from './+types/hadith';

export async function loader({ params, context }: Route.LoaderArgs) {
  const n = Number(params.number);
  if (!Number.isInteger(n) || n < 1 || n > 99999) notFound();
  const { db, dataVersion } = await dataContext(context);
  const hadith = await getHadith(db, 'bukhari', n, dataVersion);
  if (!hadith) notFound('هذا الرقم غير موجود في البيانات المحمّلة');
  return { hadith };
}

const TASHKEEL = /[\u064B-\u0652\u0670]/g;

export function meta({ loaderData: data }: Route.MetaArgs) {
  if (!data) return [{ title: 'غير موجود — رحلة الحديث' }];
  const h = data.hadith;
  const opening = (h.matnAr ?? h.textAr).replace(TASHKEEL, '').replace(/\s+/g, ' ').trim();
  const words = opening.split(' ').slice(0, 6).join(' ');
  return [
    { title: `صحيح البخاري ${h.number} — ${words}` },
    { name: 'description', content: opening.slice(0, 160) },
    { tagName: 'link', rel: 'canonical', href: `/bukhari/${h.number}` },
  ];
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

function useIsDesktop(): boolean {
  const [desk, setDesk] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1200px)');
    setDesk(mq.matches);
    const on = () => setDesk(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return desk;
}

function edgeKey(order: string[], i: number, dir: JourneyState['dir']): string {
  // Edges run teacher → student. «تتبّع الإسناد» walks student → teacher, «رحلة النقل» the reverse.
  return dir === 'trace' ? `${order[i + 1]}>${order[i]}` : `${order[i]}>${order[i + 1]}`;
}

export default function HadithPage({ loaderData }: Route.ComponentProps) {
  const { hadith } = loaderData;
  const g: IsnadGraph = hadith.graph;
  const [params, setParams] = useSearchParams();
  const reducedMotion = useReducedMotion();
  const isDesktop = useIsDesktop();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const journey = readJourney(params, g);
  const order = useMemo(() => journeyOrder(g, journey), [g, journey.routeId, journey.dir]);
  const lastStep = Math.max(0, order.length - 1);
  const step = Math.min(journey.step, lastStep);
  const nodeById = useMemo(() => new Map(g.nodes.map((n) => [n.id, n])), [g]);
  const edgeByKey = useMemo(() => new Map(g.edges.map((e) => [`${e.from}>${e.to}`, e])), [g]);

  const selectedParam = params.get('node');
  const selectedId = journey.active ? (order[step] ?? null) : selectedParam && nodeById.has(selectedParam) ? selectedParam : null;
  const selected = selectedId ? nodeById.get(selectedId) : undefined;

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(changes)) {
            if (v == null) next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [setParams],
  );

  const goStep = useCallback((s: number) => update({ step: String(Math.max(0, Math.min(lastStep, s))) }), [update, lastStep]);

  // Autoplay: one step per 1.2 s at 1×; never under reduced motion.
  useEffect(() => {
    if (!playing || !journey.active || reducedMotion) return;
    if (step >= lastStep) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => goStep(step + 1), STEP_MS / journey.speed);
    return () => clearTimeout(t);
  }, [playing, journey.active, step, lastStep, journey.speed, reducedMotion, goStep]);

  // Keyboard: Space plays/pauses; arrows follow reading direction (← is next in RTL).
  const regionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!journey.active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goStep(step + 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goStep(step - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goStep(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [journey.active, step, goStep]);

  const focus: GraphFocus = useMemo(() => {
    if (!journey.active) return { visibleNodes: null, visibleEdges: null, activeNode: null, activeEdge: null };
    const visibleNodes = new Set(order.slice(0, step + 1));
    const visibleEdges = new Set(order.slice(0, step).map((_, i) => edgeKey(order, i, journey.dir)));
    return {
      visibleNodes,
      visibleEdges,
      activeNode: order[step] ?? null,
      activeEdge: step > 0 ? edgeKey(order, step - 1, journey.dir) : null,
    };
  }, [journey.active, journey.dir, order, step]);

  const madar = g.indicators.find((i) => i.key === 'common_link')?.nodeIds ?? [];
  const textSource = hadith.sources.find((s) => g.citations.some((c) => c.id === hadith.citationId && c.sourceSlug === s.slug));
  const announce = journey.active ? stepText(order, step, journey.dir, nodeById, edgeByKey) : '';
  const done = journey.active && step >= lastStep && order.length > 0;
  const chain = g.chains.find((c) => c.id === journey.routeId);

  const narratorPane = selected ? (
    <NarratorCard node={selected} dataVersion={hadith.dataVersion} />
  ) : (
    <p className="text-ink-muted">اختر راويًا من المخطط أو من نص الإسناد لعرض ترجمته.</p>
  );

  return (
    <main id="main" className="mx-auto max-w-[1600px] px-4 py-4">
      <nav aria-label="مسار التصفح" className="mb-3 text-sm text-ink-muted">
        <Link className="link" to="/bukhari">
          صحيح البخاري
        </Link>
        {hadith.book && (
          <>
            {' / '}
            <Link className="link" to={`/bukhari/kitab/${hadith.book.number}`}>
              {hadith.book.titleAr}
            </Link>
          </>
        )}
        {' / '}
        <span>{hadith.number}</span>
      </nav>

      <div className="hadith-layout">
        {/* Hadith pane: start side (right in RTL). */}
        <section aria-labelledby="hadith-title" className="pane space-y-3">
          <header className="space-y-1">
            <h1 id="hadith-title" className="text-xl font-semibold">
              صحيح البخاري {hadith.number}
            </h1>
            {hadith.chapter && <p className="text-ink-muted">{hadith.chapter.titleAr}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <ReviewBadge status={hadith.reviewStatus} sourceKind={textSource?.kind} />
              <Cite ids={[hadith.citationId]} citations={g.citations} sources={hadith.sources} />
            </div>
            {!hadith.vocalized && <p className="text-sm text-ink-muted">هذا النص غير مشكول في مصدره المحمَّل.</p>}
          </header>
          <HadithText
            text={hadith.textAr}
            isnadLength={hadith.isnadAr ? hadith.isnadAr.length : null}
            mentions={hadith.mentions}
            hoverId={hoverId}
            onHover={setHoverId}
            onSelect={(id) => (journey.active ? null : update({ node: id }))}
          />
          <nav className="flex justify-between text-sm" aria-label="التنقل بين الأحاديث">
            {hadith.prev ? (
              <Link className="link" to={`/bukhari/${hadith.prev}`} rel="prev">
                → {hadith.prev}
              </Link>
            ) : (
              <span />
            )}
            {hadith.next && (
              <Link className="link" to={`/bukhari/${hadith.next}`} rel="next">
                {hadith.next} ←
              </Link>
            )}
          </nav>
        </section>

        {/* Graph pane: middle. */}
        <section aria-label="الإسناد" className="pane graph-pane" ref={regionRef}>
          {g.chains.length === 0 ? (
            <p className="p-4 text-ink-muted">لم يُستخرج إسناد هذا الموضع بعد؛ نصه معروض كما في مصدره.</p>
          ) : (
            <>
              <div className="journey-controls">
                {!journey.active ? (
                  <button className="btn-primary" onClick={() => update({ mode: 'journey', step: '0', node: null })}>
                    استكشاف الإسناد
                  </button>
                ) : (
                  <>
                    <button className="btn" onClick={() => setPlaying((p) => !p)} disabled={reducedMotion} aria-pressed={playing}>
                      {playing ? 'إيقاف' : 'تشغيل'}
                    </button>
                    <button className="btn" onClick={() => goStep(step - 1)} disabled={step === 0} aria-label="الخطوة السابقة">
                      →
                    </button>
                    <span className="tabular-nums text-sm" aria-hidden>
                      {step + 1} / {order.length}
                    </span>
                    <button className="btn" onClick={() => goStep(step + 1)} disabled={step >= lastStep} aria-label="الخطوة التالية">
                      ←
                    </button>
                    <button className="btn" onClick={() => goStep(0)}>
                      من البداية
                    </button>
                    <label className="text-sm">
                      <span className="sr-only">السرعة</span>
                      <select value={journey.speed} onChange={(e) => update({ speed: e.target.value })} className="select">
                        <option value="0.5">0.5×</option>
                        <option value="1">1×</option>
                        <option value="2">2×</option>
                      </select>
                    </label>
                    <button className="btn" onClick={() => update({ mode: null, step: null })}>
                      إنهاء
                    </button>
                  </>
                )}
                <div className="inline-flex rounded-md border border-hairline" role="radiogroup" aria-label="اتجاه الرحلة">
                  {(
                    [
                      ['trace', 'تتبّع الإسناد'],
                      ['journey', 'رحلة النقل'],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      role="radio"
                      aria-checked={journey.dir === v}
                      className={`seg${journey.dir === v ? ' seg-on' : ''}`}
                      onClick={() => update({ dir: v, step: '0' })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {g.chains.length > 1 && (
                  <label className="text-sm">
                    <span className="me-1">الطريق</span>
                    <select value={journey.routeId ?? ''} onChange={(e) => update({ route: e.target.value, step: '0' })} className="select">
                      {g.chains.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.routeNo}
                          {c.isSuspended ? ' (معلّق)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="graph-canvas">
                <IsnadGraphView
                  graph={g}
                  focus={focus}
                  hoverId={hoverId}
                  selectedId={selectedId}
                  tabOrder={chain ? chain.nodeIds : []}
                  onHover={setHoverId}
                  onSelect={(id) => (journey.active ? goStep(order.indexOf(id) >= 0 ? order.indexOf(id) : step) : update({ node: id }))}
                  reducedMotion={reducedMotion}
                  ringIds={madar}
                />
              </div>
              <p className="sr-only" aria-live="polite">
                {announce}
              </p>
              {done && <JourneySummary graph={g} order={order} dir={journey.dir} />}
              <TextAlternative graph={g} activeRoute={journey.routeId} />
              <Indicators graph={g} />
            </>
          )}
        </section>

        {/* Narrator pane: end side (left in RTL). On smaller screens it opens as a sheet. */}
        {isDesktop ? (
          <aside aria-label="الراوي" className="pane">
            {narratorPane}
          </aside>
        ) : (
          <Dialog.Root
            open={Boolean(selected) && !journey.active}
            onOpenChange={(open) => {
              if (!open) update({ node: null });
            }}
          >
            <Dialog.Portal>
              <Dialog.Overlay className="sheet-overlay" />
              <Dialog.Content className="sheet" aria-describedby={undefined}>
                <Dialog.Title className="sr-only">الراوي</Dialog.Title>
                {narratorPane}
                <Dialog.Close className="btn mt-4">إغلاق</Dialog.Close>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )}
        {!isDesktop && journey.active && selected && <div className="pane">{narratorPane}</div>}
      </div>
    </main>
  );
}

function stepText(
  order: string[],
  step: number,
  dir: JourneyState['dir'],
  nodeById: Map<string, IsnadGraph['nodes'][number]>,
  edgeByKey: Map<string, IsnadGraph['edges'][number]>,
): string {
  const n = nodeById.get(order[step] ?? '');
  if (!n) return '';
  const e = step > 0 ? edgeByKey.get(edgeKey(order, step - 1, dir)) : undefined;
  return `الخطوة ${step + 1} من ${order.length}: ${e?.termAr ? `${e.termAr} ` : ''}${labelOf(n)}`;
}

function JourneySummary({ graph, order, dir }: { graph: IsnadGraph; order: string[]; dir: JourneyState['dir'] }) {
  const keys = order.slice(0, -1).map((_, i) => edgeKey(order, i, dir));
  const edges = keys.map((k) => graph.edges.find((e) => `${e.from}>${e.to}` === k)).filter(Boolean) as IsnadGraph['edges'];
  const phrases = [...new Set(edges.map((e) => e.termAr).filter(Boolean))];
  const broken = edges.filter((e) => e.kind !== 'connected');
  return (
    <div className="summary" role="status">
      <h3 className="font-semibold">خلاصة الطريق</h3>
      <ul className="text-sm">
        <li>عدد الروابط: {edges.length}</li>
        <li>صيغ الأداء: {phrases.length ? phrases.join('، ') : 'غير متوفر'}</li>
        <li>{broken.length ? `روابط معلّقة أو منقطعة: ${broken.length}` : 'لا انقطاع ظاهر في هذا الطريق'}</li>
      </ul>
    </div>
  );
}

/** The graph's text equivalent: an ordered list per route and its links (SPEC §15). */
function TextAlternative({ graph, activeRoute }: { graph: IsnadGraph; activeRoute: number | null }) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const edge = new Map(graph.edges.map((e) => [`${e.from}>${e.to}`, e]));
  return (
    <details className="mt-3" open={false}>
      <summary className="cursor-pointer text-sm">الإسناد نصًا (لقارئات الشاشة وللنسخ)</summary>
      {graph.chains.map((c) => (
        <section key={c.id} className="mt-2">
          <h3 className="text-sm font-semibold">
            الطريق {c.routeNo}
            {c.id === activeRoute ? ' (المختار)' : ''} — {TERMINUS_AR[c.terminus]}
            {c.isSuspended ? '، معلّق' : ''}
          </h3>
          <ol className="list-decimal ps-6 text-sm">
            {c.nodeIds.map((id, i) => {
              const n = byId.get(id)!;
              const next = c.nodeIds[i + 1];
              const e = next ? edge.get(`${next}>${id}`) : undefined;
              return (
                <li key={`${c.id}-${i}`}>
                  {labelOf(n)}
                  {e && (
                    <span className="text-ink-muted">
                      {' '}
                      — {e.termAr ?? 'صيغة غير متوفرة'}
                      {e.kind === 'suspended' ? ' (تعليق)' : e.kind === 'gap' ? ' (انقطاع)' : ''}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </details>
  );
}

/** «مؤشرات للباحث» (SPEC §13): inputs, formula and scope; never a verdict. */
function Indicators({ graph }: { graph: IsnadGraph }) {
  if (!graph.indicators.length) return null;
  return (
    <section className="mt-3" aria-labelledby="ind-title">
      <h3 id="ind-title" className="text-sm font-semibold">
        مؤشرات للباحث
      </h3>
      <p className="text-xs text-ink-muted">إشارات تساعد الباحث، وليست أحكامًا على الحديث.</p>
      <dl className="facts mt-1 text-sm">
        {graph.indicators.map((i) => (
          <div key={i.key} className="contents">
            <dt title={`${i.formulaAr} النطاق: ${i.scopeAr}.`}>{i.labelAr}</dt>
            <dd>{i.valueAr}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
