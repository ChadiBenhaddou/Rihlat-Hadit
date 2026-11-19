import { Link } from 'react-router';
import { dataContext, notFound } from '~/lib/data.server';
import { getBook } from '../../server/data/books';
import type { Route } from './+types/kitab';

export async function loader({ params, context }: Route.LoaderArgs) {
  const n = Number(params.n);
  if (!Number.isInteger(n) || n < 1 || n > 500) notFound();
  const { db, dataVersion } = await dataContext(context);
  const book = await getBook(db, 'bukhari', n, dataVersion);
  if (!book) notFound();
  return { book };
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: data ? `${data.book.book.titleAr} — صحيح البخاري | رحلة الحديث` : 'غير موجود' }];
}

const TASHKEEL = /[\u064B-\u0652\u0670]/g;

export default function Kitab({ loaderData }: Route.ComponentProps) {
  const { book } = loaderData;
  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-2 text-sm text-ink-muted" aria-label="مسار التصفح">
        <Link className="link" to="/bukhari">
          صحيح البخاري
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold">{book.book.titleAr}</h1>
      <p className="mt-1 text-ink-muted">
        {book.chapters.length} بابًا · {book.book.hadithCount} حديثًا
      </p>
      <div className="mt-6 space-y-6">
        {book.chapters.map((ch) => (
          <section key={ch.id} aria-labelledby={`ch-${ch.id}`}>
            <h2 id={`ch-${ch.id}`} className="font-semibold leading-relaxed">
              {ch.titleAr}
            </h2>
            {ch.entries.length === 0 ? (
              <p className="text-sm text-ink-muted">لا حديث مسندًا مرقّمًا تحت هذا الباب في البيانات المحمّلة.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {ch.entries.map((e) => (
                  <li key={e.number}>
                    <Link to={`/bukhari/${e.number}`} className="entry-row">
                      <span className="tabular-nums text-ink-muted">{e.number}</span>
                      <span className="truncate">{e.openingAr.replace(TASHKEEL, '')}</span>
                      {!e.hasChain && <span className="badge shrink-0">بلا مخطط بعد</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
