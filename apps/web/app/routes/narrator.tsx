import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, redirect, useSearchParams } from 'react-router';
import { Cite } from '~/components/Cite';
import { ReportButton } from '~/components/ReportButton';
import { ReviewBadge } from '~/components/ReviewBadge';
import { dataContext, notFound } from '~/lib/data.server';
import { FLAG_AR, hijri, RELATION_AR, ROLE_AR, UNAVAILABLE } from '~/lib/format';
import { getNarrator } from '../../server/data/narrators';
import type { Route } from './+types/narrator';
import { localeOf, translate, useI18n } from '~/i18n';

// WebGL network: loaded only when opened, never in the page's initial JavaScript.
const NetworkView = lazy(() => import('~/network/NetworkView'));

export async function loader({ params, context }: Route.LoaderArgs) {
  if (!/^[a-z0-9-]{1,64}$/.test(params.slug)) notFound();
  const { db, dataVersion } = await dataContext(context);
  const narrator = await getNarrator(db, params.slug, dataVersion);
  if (!narrator) {
    // A merged narrator's old slug keeps working (SPEC §14).
    const moved = await db
      .prepare('SELECT n.slug FROM narrator_redirects r JOIN narrators n ON n.id = r.narrator_id WHERE r.old_slug = ?')
      .bind(params.slug)
      .first<{ slug: string }>();
    if (moved) throw redirect(`/narrator/${moved.slug}`, 301);
    notFound();
  }
  return { narrator };
}

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  const locale = localeOf(location.pathname);
  if (!data) return [{ title: 'غير موجود' }];
  const n = data.narrator;
  return [
    { title: `${n.displayNameAr} — ${translate(locale, 'رواة صحيح البخاري | رحلة الحديث')}` },
    {
      name: 'description',
      content: [n.fullNameAr ?? n.displayNameAr, hijri(n.deathAh, n.deathAhMax, 'ت ', locale)]
        .filter(Boolean)
        .join('، '),
    },
  ];
}

export default function Narrator({ loaderData }: Route.ComponentProps) {
  const { t, to, locale } = useI18n();
  const p = loaderData.narrator;
  const [params, setParams] = useSearchParams();
  const showNet = params.get('net') === '1';
  // WebGL needs the browser: the network mounts after hydration, never during SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const netLayout = params.get('nl') === 'tabaqa' ? 'tabaqa' : 'fa2';
  const setParam = (k: string, v: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v == null) next.delete(k);
        else next.set(k, v);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  const cite = (ids: (number | null)[]) => <Cite ids={ids} citations={p.citations} sources={p.sources} />;
  const sourceKind = p.sources[0]?.kind;
  return (
    <main id="main" className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {p.displayNameAr}
          {p.honorificAr ? ` ${p.honorificAr}` : ''}
        </h1>
        {p.fullNameAr && p.fullNameAr !== p.displayNameAr && <p className="text-ink-muted">{p.fullNameAr}</p>}
        <p className="text-sm text-ink-muted">{t(ROLE_AR[p.role])}</p>
        <div className="flex flex-wrap items-center gap-2">
          <ReviewBadge status={p.reviewStatus} sourceKind={sourceKind} />
          <ReportButton entity="narrator" entityId={p.id} label={p.displayNameAr} />
        </div>
      </header>

      <section className="pane">
        <h2 className="mb-2 font-semibold">{t('ما تذكره المصادر')}</h2>
        <dl className="facts">
          <dt>{t('الوفاة')}</dt>
          <dd>
            {hijri(p.deathAh, p.deathAhMax, '', locale) ?? t(UNAVAILABLE)} {cite([p.datesCitationId])}
          </dd>
          <dt>{t('المولد')}</dt>
          <dd>
            {hijri(p.birthAh, null, '', locale) ?? t(UNAVAILABLE)} {p.birthAh != null && cite([p.datesCitationId])}
          </dd>
          <dt>{t('الطبقة')}</dt>
          <dd>
            {p.tabaqa ?? t(UNAVAILABLE)} {p.tabaqa != null && cite([p.datesCitationId])}
          </dd>
          {p.summaryGrade && (
            <>
              <dt>{t('خلاصة الحكم')}</dt>
              <dd>
                {p.summaryGrade.textAr} {cite([p.summaryGrade.citationId])}
              </dd>
            </>
          )}
          {p.flags.map((f) => (
            <div key={f.flag} className="contents">
              <dt>{t('تنبيه')}</dt>
              <dd>
                {t(FLAG_AR[f.flag])} {cite([f.citationId])}
              </dd>
            </div>
          ))}
        </dl>
        {p.places.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {p.places.map((pl, i) => (
              <li key={i} className="chip">
                {t(RELATION_AR[pl.relation] ?? pl.relation)} {pl.nameAr} {cite([pl.citationId])}
              </li>
            ))}
          </ul>
        )}
        {p.names.length > 1 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer">
              {t('صور ورود الاسم (')}
              {p.names.length})
            </summary>
            <p className="mt-1 leading-loose">{p.names.map((n) => n.formAr).join(' · ')}</p>
          </details>
        )}
      </section>

      <section className="pane">
        <h2 className="mb-2 font-semibold">{t('الجرح والتعديل: أقوال النقاد')}</h2>
        <p className="mb-2 text-xs text-ink-muted">
          {t('أقوال منسوبة إلى قائليها كما في المصدر، تُعرض للباحث دون ترجيح.')}
        </p>
        {p.gradings.length === 0 ? (
          <p className="text-ink-muted">{t(UNAVAILABLE)}</p>
        ) : (
          <ul className="space-y-2">
            {p.gradings.map((g, i) => (
              <li key={i} lang="ar" dir="rtl">
                <span className="font-semibold">{g.criticAr}:</span> {g.statementAr} {cite([g.citationId])}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {(
          [
            [t('شيوخه في الصحيح'), p.teachers],
            [t('تلاميذه في الصحيح'), p.students],
          ] as const
        ).map(([title, list]) => (
          <section key={title} className="pane">
            <h2 className="mb-2 font-semibold">
              {title} ({list.length})
            </h2>
            {list.length === 0 ? (
              <p className="text-ink-muted">{t(UNAVAILABLE)}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {list.map((x) => (
                  <li key={x.slug} className="flex justify-between gap-2">
                    <Link className="link" to={to(`/narrator/${x.slug}`)}>
                      {x.nameAr}
                    </Link>
                    <span className="tabular-nums text-ink-muted">{x.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <section className="pane" aria-labelledby="net-title">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="net-title" className="font-semibold">
            {t('شبكة الرواة')}
          </h2>
          <button className="btn text-sm" onClick={() => setParam('net', showNet ? null : '1')} aria-expanded={showNet}>
            {showNet ? t('إخفاء الشبكة') : t('عرض الشبكة')}
          </button>
        </div>
        {showNet && mounted && p.role !== 'prophet' && (
          <Suspense fallback={<p className="text-ink-muted">{t('جارٍ تحميل الشبكة…')}</p>}>
            <NetworkView
              center={p.slug}
              centerName={p.displayNameAr}
              dataVersion={p.dataVersion}
              layoutMode={netLayout}
              onLayoutMode={(m) => setParam('nl', m === 'tabaqa' ? 'tabaqa' : null)}
            />
          </Suspense>
        )}
      </section>

      <section className="pane">
        <h2 className="mb-2 font-semibold">
          {t('أحاديثه في الصحيح (')}
          {p.hadithCount})
        </h2>
        <ul className="flex flex-wrap gap-2 text-sm">
          {p.hadithNumbers.map((n) => (
            <li key={n}>
              <Link className="chip tabular-nums" to={to(`/bukhari/${n}?node=n:${p.id}`)}>
                {n}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
