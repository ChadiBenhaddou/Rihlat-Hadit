import type { GraphNode, NarratorProfile } from '@isnad/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Cite } from './Cite';
import { ReviewBadge } from './ReviewBadge';
import { FLAG_AR, hijri, ROLE_AR, UNAVAILABLE } from '~/lib/format';

/** The narrator pane: what the sources say about the selected node, each fact cited. */
export function NarratorCard({ node, dataVersion }: { node: GraphNode; dataVersion: string }) {
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
        <p className="text-ink-muted">مصدر الحديث في الطرق المرفوعة.</p>
      </div>
    );
  }
  if (node.role === 'unresolved') {
    return (
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{node.nameAr}</h2>
        <p className="text-ink-muted">اسم مبهم في الإسناد لم يُحدَّد صاحبه في البيانات المحمّلة.</p>
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
        <p className="mt-1 text-sm text-ink-muted">{ROLE_AR[node.role]}</p>
      </div>
      {!p && !failed && <p className="text-ink-muted">جارٍ التحميل…</p>}
      {failed && <p className="text-ink-muted">تعذّر تحميل الترجمة.</p>}
      {p && (
        <>
          <ReviewBadge status={p.reviewStatus} sourceKind={sourceKind} />
          <dl className="facts">
            <dt>الوفاة</dt>
            <dd>
              {hijri(p.deathAh, p.deathAhMax) ?? UNAVAILABLE}{' '}
              <Cite ids={[p.datesCitationId]} citations={p.citations} sources={p.sources} />
            </dd>
            <dt>الطبقة</dt>
            <dd>
              {p.tabaqa ?? UNAVAILABLE} <Cite ids={[p.datesCitationId]} citations={p.citations} sources={p.sources} />
            </dd>
            <dt>البلد</dt>
            <dd>
              {lived.length ? lived.map((x) => x.nameAr).join('، ') : UNAVAILABLE}{' '}
              <Cite ids={lived.map((x) => x.citationId)} citations={p.citations} sources={p.sources} />
            </dd>
            {p.summaryGrade && (
              <>
                <dt>خلاصة الحكم</dt>
                <dd>
                  {p.summaryGrade.textAr}{' '}
                  <Cite ids={[p.summaryGrade.citationId]} citations={p.citations} sources={p.sources} />
                </dd>
              </>
            )}
            {p.flags.map((f) => (
              <div key={f.flag} className="contents">
                <dt>تنبيه</dt>
                <dd>
                  {FLAG_AR[f.flag]} <Cite ids={[f.citationId]} citations={p.citations} sources={p.sources} />
                </dd>
              </div>
            ))}
          </dl>
          {p.gradings.length > 0 && (
            <section>
              <h3 className="mb-1 font-semibold">من أقوال النقاد</h3>
              <ul className="space-y-1 text-sm">
                {p.gradings.slice(0, 3).map((g, i) => (
                  <li key={i}>
                    <span className="font-semibold">{g.criticAr}:</span> {g.statementAr}{' '}
                    <Cite ids={[g.citationId]} citations={p.citations} sources={p.sources} />
                  </li>
                ))}
              </ul>
              {p.gradings.length > 3 && (
                <p className="text-sm text-ink-muted">و{p.gradings.length - 3} قولًا آخر في صفحة الراوي.</p>
              )}
            </section>
          )}
          <p className="text-sm text-ink-muted">يروي في {p.hadithCount} حديثًا من الصحيح المحمَّل.</p>
          <Link className="link" to={`/narrator/${p.slug}`}>
            صفحة الراوي كاملة
          </Link>
        </>
      )}
    </div>
  );
}
