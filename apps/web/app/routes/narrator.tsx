import { Link } from 'react-router';
import { Cite } from '~/components/Cite';
import { ReviewBadge } from '~/components/ReviewBadge';
import { dataContext, notFound } from '~/lib/data.server';
import { FLAG_AR, hijri, RELATION_AR, ROLE_AR, UNAVAILABLE } from '~/lib/format';
import { getNarrator } from '../../server/data/narrators';
import type { Route } from './+types/narrator';

export async function loader({ params, context }: Route.LoaderArgs) {
  if (!/^[a-z0-9-]{1,64}$/.test(params.slug)) notFound();
  const { db, dataVersion } = await dataContext(context);
  const narrator = await getNarrator(db, params.slug, dataVersion);
  if (!narrator) notFound();
  return { narrator };
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  if (!data) return [{ title: 'غير موجود' }];
  const n = data.narrator;
  return [
    { title: `${n.displayNameAr} — رواة صحيح البخاري | رحلة الحديث` },
    { name: 'description', content: [n.fullNameAr ?? n.displayNameAr, hijri(n.deathAh, n.deathAhMax, 'ت ')].filter(Boolean).join('، ') },
  ];
}

export default function Narrator({ loaderData }: Route.ComponentProps) {
  const p = loaderData.narrator;
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
        <p className="text-sm text-ink-muted">{ROLE_AR[p.role]}</p>
        <ReviewBadge status={p.reviewStatus} sourceKind={sourceKind} />
      </header>

      <section className="pane">
        <h2 className="mb-2 font-semibold">ما تذكره المصادر</h2>
        <dl className="facts">
          <dt>الوفاة</dt>
          <dd>
            {hijri(p.deathAh, p.deathAhMax) ?? UNAVAILABLE} {cite([p.datesCitationId])}
          </dd>
          <dt>المولد</dt>
          <dd>
            {hijri(p.birthAh) ?? UNAVAILABLE} {p.birthAh != null && cite([p.datesCitationId])}
          </dd>
          <dt>الطبقة</dt>
          <dd>
            {p.tabaqa ?? UNAVAILABLE} {p.tabaqa != null && cite([p.datesCitationId])}
          </dd>
          {p.summaryGrade && (
            <>
              <dt>خلاصة الحكم</dt>
              <dd>
                {p.summaryGrade.textAr} {cite([p.summaryGrade.citationId])}
              </dd>
            </>
          )}
          {p.flags.map((f) => (
            <div key={f.flag} className="contents">
              <dt>تنبيه</dt>
              <dd>
                {FLAG_AR[f.flag]} {cite([f.citationId])}
              </dd>
            </div>
          ))}
        </dl>
        {p.places.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {p.places.map((pl, i) => (
              <li key={i} className="chip">
                {RELATION_AR[pl.relation] ?? pl.relation} {pl.nameAr} {cite([pl.citationId])}
              </li>
            ))}
          </ul>
        )}
        {p.names.length > 1 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer">صور ورود الاسم ({p.names.length})</summary>
            <p className="mt-1 leading-loose">{p.names.map((n) => n.formAr).join(' · ')}</p>
          </details>
        )}
      </section>

      <section className="pane">
        <h2 className="mb-2 font-semibold">الجرح والتعديل: أقوال النقاد</h2>
        <p className="mb-2 text-xs text-ink-muted">أقوال منسوبة إلى قائليها كما في المصدر، تُعرض للباحث دون ترجيح.</p>
        {p.gradings.length === 0 ? (
          <p className="text-ink-muted">{UNAVAILABLE}</p>
        ) : (
          <ul className="space-y-2">
            {p.gradings.map((g, i) => (
              <li key={i}>
                <span className="font-semibold">{g.criticAr}:</span> {g.statementAr} {cite([g.citationId])}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {(
          [
            ['شيوخه في الصحيح', p.teachers],
            ['تلاميذه في الصحيح', p.students],
          ] as const
        ).map(([title, list]) => (
          <section key={title} className="pane">
            <h2 className="mb-2 font-semibold">
              {title} ({list.length})
            </h2>
            {list.length === 0 ? (
              <p className="text-ink-muted">{UNAVAILABLE}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {list.map((t) => (
                  <li key={t.slug} className="flex justify-between gap-2">
                    <Link className="link" to={`/narrator/${t.slug}`}>
                      {t.nameAr}
                    </Link>
                    <span className="tabular-nums text-ink-muted">{t.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <section className="pane">
        <h2 className="mb-2 font-semibold">أحاديثه في الصحيح ({p.hadithCount})</h2>
        <ul className="flex flex-wrap gap-2 text-sm">
          {p.hadithNumbers.map((n) => (
            <li key={n}>
              <Link className="chip tabular-nums" to={`/bukhari/${n}?node=n:${p.id}`}>
                {n}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
