import { normalizeArabic, stemArabic } from '@isnad/shared';
import { Link, redirect } from 'react-router';
import { SearchBox } from '~/components/SearchBox';
import { dataContext } from '~/lib/data.server';
import { hijri } from '~/lib/format';
import { searchHadith, searchNarrators } from '../../server/data/search';
import type { Route } from './+types/search';
import { localeOf, translate, useI18n } from '~/i18n';

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
  const type = url.searchParams.get('type') === 'narrator' ? 'narrator' : 'hadith';
  const cursor = Math.max(0, Math.min(10_000, Number(url.searchParams.get('cursor')) || 0));
  if (!q) return { q, type, result: null };
  const { env, db, search, dataVersion } = await dataContext(context);
  const ip = request.headers.get('cf-connecting-ip') ?? 'local';
  if (!(await env.SEARCH_LIMITER.limit({ key: ip })).success)
    throw new Response('طلبات كثيرة، حاول بعد قليل', { status: 429 });
  const result =
    type === 'narrator'
      ? await searchNarrators(db, search, q, cursor, dataVersion)
      : await searchHadith(db, search, q, cursor, dataVersion);
  // A bare number that exists goes straight to the entry.
  if (type === 'hadith' && result.numberMatch != null && result.results.length <= 1 && cursor === 0)
    throw redirect(`/bukhari/${result.numberMatch}`);
  return { q, type, result };
}

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  return [
    {
      title: data?.q
        ? translate(localeOf(location.pathname), 'بحث: {q} | رحلة الحديث', { q: data.q })
        : translate(localeOf(location.pathname), 'البحث | رحلة الحديث'),
    },
    { name: 'robots', content: 'noindex' },
  ];
}

/** Highlight on the original text: tokenize with tashkeel intact, normalize each word, mark matches (SPEC §9). */
function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  const parts = text.split(/(\s+)/);
  return (
    <>
      {parts.map((w, i) => {
        const n = normalizeArabic(w);
        const hit = n && terms.some((t) => n.startsWith(t) || stemArabic(n).startsWith(t));
        return hit ? <mark key={i}>{w}</mark> : <span key={i}>{w}</span>;
      })}
    </>
  );
}

export default function Search({ loaderData }: Route.ComponentProps) {
  const { t, to, locale } = useI18n();
  const { q, type, result } = loaderData;
  const tab = (t: string, label: string) => (
    <Link
      className={`seg${type === t ? ' seg-on' : ''}`}
      to={to(`/search?type=${t}&q=${encodeURIComponent(q)}`)}
      aria-current={type === t ? 'page' : undefined}
    >
      {label}
    </Link>
  );
  return (
    <main id="main" className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('البحث')}</h1>
      <SearchBox defaultValue={q} type={type} />
      <nav className="inline-flex rounded-md border border-hairline" aria-label={t('نوع البحث')}>
        {tab('hadith', t('الأحاديث'))}
        {tab('narrator', t('الرواة'))}
      </nav>
      {result && (
        <>
          <p className="text-sm text-ink-muted" role="status">
            {result.results.length
              ? t('النتائج: {n}', { n: result.results.length })
              : t('لا نتائج. جرّب كلمات أقل أو صيغة أخرى.')}
          </p>
          <ol className="space-y-3">
            {result.results.map((r) =>
              r.kind === 'hadith' ? (
                <li key={`h${r.number}`}>
                  <Link to={to(`/bukhari/${r.number}`)} className="card block space-y-1">
                    <div className="text-sm text-ink-muted">
                      {t('صحيح البخاري {n}', { n: r.number })}
                      {r.bookTitleAr ? ` · ${r.bookTitleAr}` : ''}
                    </div>
                    <p className="hadith-snippet line-clamp-3" lang="ar" dir="rtl">
                      <Highlighted text={r.textAr} terms={result.terms} />
                    </p>
                  </Link>
                </li>
              ) : (
                <li key={`n${r.slug}`}>
                  <Link to={to(`/narrator/${r.slug}`)} className="card block">
                    <div className="font-semibold">{r.nameAr}</div>
                    {/* Death year, city and tabaqa in every result: many narrators share names (SPEC §9). */}
                    <div className="text-sm text-ink-muted">
                      {[
                        hijri(r.deathAh, null, t('ت '), locale) ?? t('سنة الوفاة غير متوفرة'),
                        r.placeAr ?? t('البلد غير متوفر'),
                        r.tabaqa != null ? t('الطبقة {n}', { n: r.tabaqa }) : t('الطبقة غير متوفرة'),
                        t('{n} حديثًا', { n: r.hadithCount }),
                      ].join(' · ')}
                    </div>
                  </Link>
                </li>
              ),
            )}
          </ol>
          {result.nextCursor && (
            <Link
              className="btn"
              to={to(`/search?type=${type}&q=${encodeURIComponent(q)}&cursor=${result.nextCursor}`)}
            >
              {t('المزيد')}
            </Link>
          )}
        </>
      )}
    </main>
  );
}
