/**
 * The three-pane hadith page (SPEC §11): hadith text at the start (right in
 * RTL), the isnad graph in the middle, the narrator pane at the end. View state
 * lives in the query string: ?route=&mode=journey&dir=trace&step=&node=
 */
import * as Dialog from '@radix-ui/react-dialog';
import type { IsnadGraph, SourceInfo } from '@isnad/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Cite } from '~/components/Cite';
import { HadithText } from '~/components/HadithText';
import { NarratorCard } from '~/components/NarratorCard';
import { ReportButton } from '~/components/ReportButton';
import { ReviewBadge } from '~/components/ReviewBadge';
import { bukhariTeacher, depthFromSource, divergencePoints, filterRoutes, routeLength } from '@isnad/graph';
import { IsnadGraphView, labelOf, type GraphFocus, type LayoutMode } from '~/graph/IsnadGraphView';
import { journeyOrder, readJourney, STEP_MS, type JourneyState } from '~/graph/journey';
import { dataContext, notFound } from '~/lib/data.server';
import { TERMINUS_AR } from '~/lib/format';
import { getGroupGraph } from '../../server/data/graph';
import { getHadith } from '../../server/data/hadith';
import type { Route } from './+types/hadith';
import { INDICATOR_EN, INDICATOR_SCOPE_EN, localeOf, translate, translateIndicator, useI18n } from '~/i18n';

export async function loader({ params, context, request }: Route.LoaderArgs) {
  const n = Number(params.number);
  if (!Number.isInteger(n) || n < 1 || n > 99999) notFound();
  const { db, dataVersion } = await dataContext(context);
  const hadith = await getHadith(db, 'bukhari', n, dataVersion);
  if (!hadith) notFound('هذا الرقم غير موجود في البيانات المحمّلة');
  // All routes (SPEC §12 ج): the merged graph of every entry in this hadith's group, one more batch.
  const wantAll = new URL(request.url).searchParams.get('view') === 'all';
  const group = wantAll && hadith.groupId != null ? await getGroupGraph(db, hadith.groupId, dataVersion) : null;
  return { hadith, group };
}

const TASHKEEL = /[\u064B-\u0652\u0670]/g;

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [{ title: 'غير موجود — رحلة الحديث' }];
  const h = data.hadith;
  const opening = (h.matnAr ?? h.textAr).replace(TASHKEEL, '').replace(/\s+/g, ' ').trim();
  const words = opening.split(' ').slice(0, 6).join(' ');
  return [
    { title: `${translate(localeOf(location.pathname), 'صحيح البخاري {n}', { n: h.number })} — ${words}` },
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
  const { t, to, dir } = useI18n();
  // Arrows follow reading direction (SPEC §12): forward is ← in Arabic and → in English.
  const [back, fwd] = dir === 'rtl' ? ['→', '←'] : ['←', '→'];
  const [fwdKey, backKey] = dir === 'rtl' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowRight', 'ArrowLeft'];
  const { hadith, group } = loaderData;
  const [params, setParams] = useSearchParams();
  const allView = params.get('view') === 'all' && group != null;
  const layoutMode: LayoutMode = params.get('layout') === 'timeline' ? 'timeline' : 'layered';
  const baseGraph: IsnadGraph = allView ? group.graph : hadith.graph;
  const teacherFilter = params.get('t');
  const maxLen = Number(params.get('len')) || 0;
  const onlyConnected = params.get('hu') === '1';
  const g: IsnadGraph = useMemo(() => {
    if (!allView) return baseGraph;
    const broken = new Set(baseGraph.edges.filter((e) => e.kind !== 'connected').flatMap((e) => e.chainIds));
    return filterRoutes(
      baseGraph,
      (c) =>
        (!teacherFilter || bukhariTeacher(c) === teacherFilter) &&
        (!maxLen || routeLength(baseGraph, c) <= maxLen) &&
        (!onlyConnected || !broken.has(c.id)),
    );
  }, [allView, baseGraph, teacherFilter, maxLen, onlyConnected]);
  const reducedMotion = useReducedMotion();
  const isDesktop = useIsDesktop();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const journeyRaw = readJourney(params, g);
  // The journey follows one entry's route; the all-routes view is explored, not played.
  const journey = { ...journeyRaw, active: journeyRaw.active && !allView };
  const order = useMemo(() => journeyOrder(g, journey), [g, journey.routeId, journey.dir]);
  const lastStep = Math.max(0, order.length - 1);
  const step = Math.min(journey.step, lastStep);
  const nodeById = useMemo(() => new Map(g.nodes.map((n) => [n.id, n])), [g]);
  const edgeByKey = useMemo(() => new Map(g.edges.map((e) => [`${e.from}>${e.to}`, e])), [g]);

  const selectedParam = params.get('node');
  const selectedId = journey.active
    ? (order[step] ?? null)
    : selectedParam && nodeById.has(selectedParam)
      ? selectedParam
      : null;
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

  const goStep = useCallback(
    (s: number) => update({ step: String(Math.max(0, Math.min(lastStep, s))) }),
    [update, lastStep],
  );

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
      } else if (e.key === fwdKey) {
        e.preventDefault();
        goStep(step + 1);
      } else if (e.key === backKey) {
        e.preventDefault();
        goStep(step - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goStep(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [journey.active, step, goStep, fwdKey, backKey]);

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

  const madar = baseGraph.indicators.find((i) => i.key === 'common_link')?.nodeIds ?? [];
  const divergence = useMemo(() => (allView ? divergencePoints(g) : []), [allView, g]);
  const routeHue = useMemo(
    () => new Map(baseGraph.chains.map((c, i) => [c.id, `var(--route-${(i % 8) + 1})`])),
    [baseGraph],
  );
  // A link used by one route carries that route's hue; shared trunks stay neutral, so convergence shows.
  const edgeColor = useCallback(
    (key: string) => {
      if (!allView) return undefined;
      const e = g.edges.find((x) => `${x.from}>${x.to}` === key);
      return e && e.chainIds.length === 1 ? routeHue.get(e.chainIds[0]!) : undefined;
    },
    [allView, g, routeHue],
  );
  const growDelay = useMemo(
    () => (allView ? new Map([...depthFromSource(g)].map(([id, d]) => [id, d * 220])) : undefined),
    [allView, g],
  );
  const selectedEdge = allView ? params.get('edge') : null;
  const edgeEntries = selectedEdge
    ? [
        ...new Set(
          (g.edges.find((e) => `${e.from}>${e.to}` === selectedEdge)?.chainIds ?? []).map(
            (id) => g.chains.find((c) => c.id === id)!.hadithNumber,
          ),
        ),
      ].sort((a, b) => a - b)
    : [];
  const teachers = useMemo(
    () =>
      [...new Set(baseGraph.chains.map((c) => bukhariTeacher(c)).filter((x): x is string => Boolean(x)))].map((id) => ({
        id,
        name: baseGraph.nodes.find((n) => n.id === id)?.nameAr ?? id,
      })),
    [baseGraph],
  );
  const groupEntries = [...new Set(baseGraph.chains.map((c) => c.hadithNumber))].sort((a, b) => a - b);
  const textSource = hadith.sources.find((s) =>
    hadith.graph.citations.some((c) => c.id === hadith.citationId && c.sourceSlug === s.slug),
  );
  const announce = journey.active ? stepText(order, step, journey.dir, nodeById, edgeByKey, t) : '';
  const done = journey.active && step >= lastStep && order.length > 0;
  const chain = g.chains.find((c) => c.id === journey.routeId);

  const narratorPane = selected ? (
    <NarratorCard node={selected} dataVersion={hadith.dataVersion} />
  ) : (
    <p className="text-ink-muted">{t('اختر راويًا من المخطط أو من نص الإسناد لعرض ترجمته.')}</p>
  );

  return (
    <main id="main" className="mx-auto max-w-[1600px] px-4 py-4">
      <nav aria-label={t('مسار التصفح')} className="mb-3 text-sm text-ink-muted">
        <Link className="link" to={to('/bukhari')}>
          {t('صحيح البخاري')}
        </Link>
        {hadith.book && (
          <>
            {' / '}
            <Link className="link" to={to(`/bukhari/kitab/${hadith.book.number}`)}>
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
              {t('صحيح البخاري {n}', { n: hadith.number })}
            </h1>
            {hadith.chapter && <p className="text-ink-muted">{hadith.chapter.titleAr}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <ReviewBadge status={hadith.reviewStatus} sourceKind={textSource?.kind} />
              <Cite ids={[hadith.citationId]} citations={g.citations} sources={hadith.sources} />
            </div>
            {!hadith.vocalized && <p className="text-sm text-ink-muted">{t('هذا النص غير مشكول في مصدره المحمَّل.')}</p>}
          </header>
          <HadithText
            text={hadith.textAr}
            isnadLength={hadith.isnadAr ? hadith.isnadAr.length : null}
            mentions={hadith.mentions}
            hoverId={hoverId}
            onHover={setHoverId}
            onSelect={(id) => (journey.active ? null : update({ node: id }))}
          />
          <ReportButton entity="hadith" entityId={hadith.number} label={t('صحيح البخاري {n}', { n: hadith.number })} />
          <nav className="flex justify-between text-sm" aria-label={t('التنقل بين الأحاديث')}>
            {hadith.prev ? (
              <Link className="link" to={to(`/bukhari/${hadith.prev}`)} rel="prev">
                {back} {hadith.prev}
              </Link>
            ) : (
              <span />
            )}
            {hadith.next && (
              <Link className="link" to={to(`/bukhari/${hadith.next}`)} rel="next">
                {hadith.next} {fwd}
              </Link>
            )}
          </nav>
        </section>

        {/* Graph pane: middle. */}
        <section aria-label={t('الإسناد')} className="pane graph-pane" ref={regionRef}>
          {g.chains.length === 0 ? (
            <p className="p-4 text-ink-muted">{t('لم يُستخرج إسناد هذا الموضع بعد؛ نصه معروض كما في مصدره.')}</p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {hadith.groupId != null && (
                  <div
                    className="inline-flex rounded-md border border-hairline"
                    role="radiogroup"
                    aria-label={t('نطاق العرض')}
                  >
                    <button
                      role="radio"
                      aria-checked={!allView}
                      className={`seg${!allView ? ' seg-on' : ''}`}
                      onClick={() => update({ view: null, edge: null, t: null, len: null, hu: null })}
                    >
                      {t('هذا الموضع')}
                    </button>
                    <button
                      role="radio"
                      aria-checked={allView}
                      className={`seg${allView ? ' seg-on' : ''}`}
                      onClick={() => update({ view: 'all', mode: null, step: null, node: null })}
                    >
                      {t('جميع الطرق')}
                    </button>
                  </div>
                )}
                <div
                  className="inline-flex rounded-md border border-hairline"
                  role="radiogroup"
                  aria-label={t('تخطيط المخطط')}
                >
                  <button
                    role="radio"
                    aria-checked={layoutMode === 'layered'}
                    className={`seg${layoutMode === 'layered' ? ' seg-on' : ''}`}
                    onClick={() => update({ layout: null })}
                  >
                    {t('طبقات')}
                  </button>
                  <button
                    role="radio"
                    aria-checked={layoutMode === 'timeline'}
                    className={`seg${layoutMode === 'timeline' ? ' seg-on' : ''}`}
                    onClick={() => update({ layout: 'timeline' })}
                  >
                    {t('خط زمني')}
                  </button>
                </div>
              </div>
              {allView ? (
                <div className="journey-controls">
                  <p className="w-full text-sm text-ink-muted">
                    {g.chains.length} {t('طريقًا من')} {groupEntries.length} {t('مواضع:')}{' '}
                    {groupEntries.map((n, i) => (
                      <span key={n}>
                        {i ? t('، ') : ''}
                        <Link className="link" to={to(`/bukhari/${n}?view=all`)}>
                          {n}
                        </Link>
                        {n !== hadith.number && (
                          <Link
                            className="ms-1 text-xs text-ink-muted underline"
                            to={to(`/compare/${hadith.number}/${n}`)}
                            aria-label={t('قارن {a} مع {b}', { a: hadith.number, b: n })}
                          >
                            {t('(قارن)')}
                          </Link>
                        )}
                      </span>
                    ))}
                  </p>
                  <label className="text-sm">
                    <span className="me-1">{t('شيخ البخاري')}</span>
                    <select
                      className="select"
                      value={teacherFilter ?? ''}
                      onChange={(e) => update({ t: e.target.value || null, edge: null })}
                    >
                      <option value="">{t('الكل')}</option>
                      {teachers.map((tc) => (
                        <option key={tc.id} value={tc.id}>
                          {tc.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="me-1">{t('طول الإسناد حتى')}</span>
                    <select
                      className="select"
                      value={maxLen || ''}
                      onChange={(e) => update({ len: e.target.value || null, edge: null })}
                    >
                      <option value="">{t('أي طول')}</option>
                      {[3, 4, 5, 6, 7, 8].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={onlyConnected}
                      onChange={(e) => update({ hu: e.target.checked ? '1' : null, edge: null })}
                    />
                    {t('إخفاء الطرق المعلّقة والمنقطعة وغير المؤكدة')}
                  </label>
                </div>
              ) : (
                <div className="journey-controls">
                  {!journey.active ? (
                    <button className="btn-primary" onClick={() => update({ mode: 'journey', step: '0', node: null })}>
                      {t('استكشاف الإسناد')}
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn"
                        onClick={() => setPlaying((p) => !p)}
                        disabled={reducedMotion}
                        aria-pressed={playing}
                      >
                        {playing ? t('إيقاف') : t('تشغيل')}
                      </button>
                      <button
                        className="btn"
                        onClick={() => goStep(step - 1)}
                        disabled={step === 0}
                        aria-label={t('الخطوة السابقة')}
                      >
                        {back}
                      </button>
                      <span className="tabular-nums text-sm" aria-hidden>
                        {step + 1} / {order.length}
                      </span>
                      <button
                        className="btn"
                        onClick={() => goStep(step + 1)}
                        disabled={step >= lastStep}
                        aria-label={t('الخطوة التالية')}
                      >
                        {fwd}
                      </button>
                      <button className="btn" onClick={() => goStep(0)}>
                        {t('من البداية')}
                      </button>
                      <label className="text-sm">
                        <span className="sr-only">{t('السرعة')}</span>
                        <select
                          value={journey.speed}
                          onChange={(e) => update({ speed: e.target.value })}
                          className="select"
                        >
                          <option value="0.5">0.5×</option>
                          <option value="1">1×</option>
                          <option value="2">2×</option>
                        </select>
                      </label>
                      <button className="btn" onClick={() => update({ mode: null, step: null })}>
                        {t('إنهاء')}
                      </button>
                    </>
                  )}
                  <div
                    className="inline-flex rounded-md border border-hairline"
                    role="radiogroup"
                    aria-label={t('اتجاه الرحلة')}
                  >
                    {(
                      [
                        ['trace', t('تتبّع الإسناد')],
                        ['journey', t('رحلة النقل')],
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
                      <span className="me-1">{t('الطريق')}</span>
                      <select
                        value={journey.routeId ?? ''}
                        onChange={(e) => update({ route: e.target.value, step: '0' })}
                        className="select"
                      >
                        {g.chains.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.routeNo}
                            {c.isSuspended ? t(' (معلّق)') : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}
              <div className="graph-canvas">
                <IsnadGraphView
                  graph={g}
                  focus={focus}
                  hoverId={hoverId}
                  selectedId={selectedId}
                  tabOrder={chain ? chain.nodeIds : []}
                  onHover={setHoverId}
                  onSelect={(id) =>
                    journey.active ? goStep(order.indexOf(id) >= 0 ? order.indexOf(id) : step) : update({ node: id })
                  }
                  reducedMotion={reducedMotion}
                  ringIds={madar}
                  layoutMode={layoutMode}
                  markIds={divergence}
                  edgeColor={edgeColor}
                  growDelay={growDelay}
                  selectedEdge={selectedEdge}
                  {...(allView ? { onSelectEdge: (key: string) => update({ edge: key }) } : {})}
                />
              </div>
              {allView && (
                <p className="mt-2 text-xs text-ink-muted">
                  {t(
                    t(
                      'الحلقة «المدار» حيث تلتقي الطرق، و«تفرّع» حيث تفترق. سُمك الخط بعدد الطرق المارّة به، ولون الطريق المنفرد يميّزه. اضغط رابطًا لعرض مواضعه.',
                    ),
                  )}
                </p>
              )}
              {selectedEdge && (
                <div className="summary" role="status">
                  <h3 className="font-semibold">{t('المواضع التي تستعمل هذا الرابط')}</h3>
                  <ul className="mt-1 flex flex-wrap gap-2 text-sm">
                    {edgeEntries.map((n) => (
                      <li key={n}>
                        <Link className="chip tabular-nums" to={to(`/bukhari/${n}`)}>
                          {n}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="sr-only" aria-live="polite">
                {announce}
              </p>
              {done && <JourneySummary graph={g} order={order} dir={journey.dir} />}
              <TextAlternative graph={g} activeRoute={journey.routeId} />
              <Indicators graph={baseGraph} sources={allView ? group.sources : hadith.sources} />
            </>
          )}
        </section>

        {/* Narrator pane: end side (left in RTL). On smaller screens it opens as a sheet. */}
        {isDesktop ? (
          <aside aria-label={t('الراوي')} className="pane">
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
                <Dialog.Title className="sr-only">{t('الراوي')}</Dialog.Title>
                {narratorPane}
                <Dialog.Close className="btn mt-4">{t('إغلاق')}</Dialog.Close>
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
  t: (ar: string | undefined, vars?: Record<string, string | number>) => string,
): string {
  const n = nodeById.get(order[step] ?? '');
  if (!n) return '';
  const e = step > 0 ? edgeByKey.get(edgeKey(order, step - 1, dir)) : undefined;
  return `${t('الخطوة {k} من {n}', { k: step + 1, n: order.length })}: ${e?.termAr ? `${e.termAr} ` : ''}${labelOf(n)}`;
}

function JourneySummary({ graph, order, dir }: { graph: IsnadGraph; order: string[]; dir: JourneyState['dir'] }) {
  const { t } = useI18n();
  const keys = order.slice(0, -1).map((_, i) => edgeKey(order, i, dir));
  const edges = keys
    .map((k) => graph.edges.find((e) => `${e.from}>${e.to}` === k))
    .filter(Boolean) as IsnadGraph['edges'];
  const phrases = [...new Set(edges.map((e) => e.termAr).filter(Boolean))];
  const broken = edges.filter((e) => e.kind !== 'connected');
  return (
    <div className="summary" role="status">
      <h3 className="font-semibold">{t('خلاصة الطريق')}</h3>
      <ul className="text-sm">
        <li>
          {t('عدد الروابط:')} {edges.length}
        </li>
        <li>
          {t('صيغ الأداء:')} {phrases.length ? phrases.join(t('، ')) : t('غير متوفر')}
        </li>
        <li>
          {broken.length ? t('روابط معلّقة أو منقطعة: {n}', { n: broken.length }) : t('لا انقطاع ظاهر في هذا الطريق')}
        </li>
      </ul>
    </div>
  );
}

/** The graph's text equivalent: an ordered list per route and its links (SPEC §15). */
function TextAlternative({ graph, activeRoute }: { graph: IsnadGraph; activeRoute: number | null }) {
  const { t } = useI18n();
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const edge = new Map(graph.edges.map((e) => [`${e.from}>${e.to}`, e]));
  return (
    <details className="mt-3" open={false}>
      <summary className="cursor-pointer text-sm">{t('الإسناد نصًا (لقارئات الشاشة وللنسخ)')}</summary>
      {graph.chains.map((c) => (
        <section key={c.id} className="mt-2">
          <h3 className="text-sm font-semibold">
            {t('الطريق')} {c.routeNo}
            {c.id === activeRoute ? t(' (المختار)') : ''} — {t(TERMINUS_AR[c.terminus])}
            {c.isSuspended ? t('، معلّق') : ''}
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
                      — {e.termAr ?? t('صيغة غير متوفرة')}
                      {e.kind === 'suspended' ? t(' (تعليق)') : e.kind === 'gap' ? t(' (انقطاع)') : ''}
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

/** «مؤشرات للباحث» (SPEC §13): inputs, formula and scope; neutral words, no combined score, never a verdict. */
function Indicators({ graph, sources }: { graph: IsnadGraph; sources: SourceInfo[] }) {
  const { t, locale } = useI18n();
  const en = locale === 'en';
  if (!graph.indicators.length) return null;
  return (
    <section className="mt-3" aria-labelledby="ind-title">
      <h3 id="ind-title" className="text-sm font-semibold">
        {t('مؤشرات للباحث')}
      </h3>
      <p className="text-xs text-ink-muted">{t('إشارات تساعد الباحث، وليست أحكامًا على الحديث.')}</p>
      <div className="mt-1 space-y-1">
        {graph.indicators.map((i) => (
          <details key={i.key} className="indicator">
            <summary className="flex cursor-pointer flex-wrap justify-between gap-2 text-sm">
              <span className="font-semibold">{en ? (INDICATOR_EN[i.key]?.label ?? i.labelAr) : i.labelAr}</span>
              <span>{translateIndicator(locale, i.valueAr)}</span>
            </summary>
            <p className="mt-1 text-xs text-ink-muted">
              {en ? INDICATOR_EN[i.key]?.formula : i.formulaAr} {t('النطاق:')} {en ? INDICATOR_SCOPE_EN : i.scopeAr}.
            </p>
            {i.inputs.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs">
                {i.inputs.map((x, k) => (
                  <li key={k}>
                    {translateIndicator(locale, x.labelAr)}
                    {x.value != null && <>: {translateIndicator(locale, x.value)}</>}{' '}
                    <Cite ids={x.citationIds} citations={graph.citations} sources={sources} />
                  </li>
                ))}
              </ul>
            )}
          </details>
        ))}
      </div>
    </section>
  );
}
