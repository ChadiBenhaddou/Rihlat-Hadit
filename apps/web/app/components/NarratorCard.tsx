import type { GraphNode, NarratorProfile } from '@isnad/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Cite } from './Cite';
import { ReviewBadge } from './ReviewBadge';
import { FLAG_AR, hijri, ROLE_AR, UNAVAILABLE } from '~/lib/format';
import { useI18n } from '~/i18n';

/** The narrator pane: what the sources say about the selected node, each fact cited. */
export function NarratorCard({ node, dataVersion }: { node: GraphNode; dataVersion: string }) {
  const { t, to, locale } = useI18n();
  const [profile, setProfile] = useState<NarratorProfile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setProfile(null);
    setFailed(false);
    if (!node.slug || node.role === 'prophet') return;
    const ctl = new AbortController();
    fetch(`/api/v1/d/${encodeURIComponent(dataVersion)}/narrators/${node.slug}`, { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<NarratorProfile>) : Promise.reject(new Error(String(r.status)))))
      .then(setProfile)
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') setFailed(true);
      });
    return () => ctl.abort();
  }, [node.slug, node.role, dataVersion]);

  const name = node.honorificAr ? `${node.nameAr} ${node.honorificAr}` : node.nameAr;
  if (node.role === 'prophet') {
    return (
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{name}</h2>
        <p className="text-ink-muted">{t('مصدر الحديث في الطرق المرفوعة.')}</p>
      </div>
    );
  }
  if (node.role === 'unresolved') {
    return (
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{node.nameAr}</h2>
        <p className="text-ink-muted">{t('اسم مبهم في الإسناد لم يُحدَّد صاحبه في البيانات المحمّلة.')}</p>
      </div>
    );
  }
  const p = profile;
  const sourceKind = p?.sources.find((s) =>
    p.citations.some((c) => c.id === p.datesCitationId && c.sourceSlug === s.slug),
  )?.kind;
  const lived = p?.places.filter((x) => x.relation === 'lived') ?? [];
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold">{name}</h2>
        {p?.fullNameAr && p.fullNameAr !== p.displayNameAr && <p className="text-sm text-ink-muted">{p.fullNameAr}</p>}
        <p className="mt-1 text-sm text-ink-muted">{t(ROLE_AR[node.role])}</p>
      </div>
      {!p && !failed && <p className="text-ink-muted">{t('جارٍ التحميل…')}</p>}
      {failed && <p className="text-ink-muted">{t('تعذّر تحميل الترجمة.')}</p>}
      {p && (
        <>
          <ReviewBadge status={p.reviewStatus} sourceKind={sourceKind} />
          <dl className="facts">
            <dt>{t('الوفاة')}</dt>
            <dd>
              {hijri(p.deathAh, p.deathAhMax, '', locale) ?? t(UNAVAILABLE)}{' '}
              <Cite ids={[p.datesCitationId]} citations={p.citations} sources={p.sources} />
            </dd>
            <dt>{t('الطبقة')}</dt>
            <dd>
              {p.tabaqa ?? t(UNAVAILABLE)}{' '}
              <Cite ids={[p.datesCitationId]} citations={p.citations} sources={p.sources} />
            </dd>
            <dt>{t('البلد')}</dt>
            <dd>
              {lived.length ? lived.map((x) => x.nameAr).join(t('، ')) : t(UNAVAILABLE)}{' '}
              <Cite ids={lived.map((x) => x.citationId)} citations={p.citations} sources={p.sources} />
            </dd>
            {p.summaryGrade && (
              <>
                <dt>{t('خلاصة الحكم')}</dt>
                <dd>
                  {p.summaryGrade.textAr}{' '}
                  <Cite ids={[p.summaryGrade.citationId]} citations={p.citations} sources={p.sources} />
                </dd>
              </>
            )}
            {p.flags.map((f) => (
              <div key={f.flag} className="contents">
                <dt>{t('تنبيه')}</dt>
                <dd>
                  {t(FLAG_AR[f.flag])} <Cite ids={[f.citationId]} citations={p.citations} sources={p.sources} />
                </dd>
              </div>
            ))}
          </dl>
          {p.gradings.length > 0 && (
            <section>
              <h3 className="mb-1 font-semibold">{t('من أقوال النقاد')}</h3>
              <ul className="space-y-1 text-sm">
                {p.gradings.slice(0, 3).map((g, i) => (
                  <li key={i}>
                    <span className="font-semibold">{g.criticAr}:</span> {g.statementAr}{' '}
                    <Cite ids={[g.citationId]} citations={p.citations} sources={p.sources} />
                  </li>
                ))}
              </ul>
              {p.gradings.length > 3 && (
                <p className="text-sm text-ink-muted">
                  {t('و')}
                  {p.gradings.length - 3} {t('قولًا آخر في صفحة الراوي.')}
                </p>
              )}
            </section>
          )}
          <p className="text-sm text-ink-muted">
            {t('يروي في')} {p.hadithCount} {t('حديثًا من الصحيح المحمَّل.')}
          </p>
          <Link className="link" to={to(`/narrator/${p.slug}`)}>
            {t('صفحة الراوي كاملة')}
          </Link>
        </>
      )}
    </div>
  );
}
