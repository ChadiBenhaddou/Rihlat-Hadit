import { Link } from 'react-router';
import { dataContext, notFound } from '~/lib/data.server';
import { listBooks } from '../../server/data/books';
import type { Route } from './+types/bukhari';
import { useI18n } from '~/i18n';
import { localeOf, translate } from '~/i18n';

export async function loader({ context }: Route.LoaderArgs) {
  const { db, dataVersion } = await dataContext(context);
  const books = await listBooks(db, 'bukhari', dataVersion);
  if (!books) notFound();
  return { books };
}

export function meta({ location }: Route.MetaArgs) {
  const l = localeOf(location.pathname);
  return [
    { title: translate(l, 'صحيح البخاري — كتب الصحيح | رحلة الحديث') },
    { name: 'description', content: translate(l, 'كتب صحيح البخاري وأبوابها بتراجم البخاري.') },
  ];
}

export default function Bukhari({ loaderData }: Route.ComponentProps) {
  const { t, to } = useI18n();
  const { books } = loaderData;
  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{books.collection.nameAr}</h1>
      <p className="mt-1 text-ink-muted">
        {books.books.length} {t('كتابًا، بترقيم محمد فؤاد عبد الباقي.')}
      </p>
      <ol className="mt-6 grid gap-2 sm:grid-cols-2">
        {books.books.map((b) => (
          <li key={b.number}>
            <Link to={to(`/bukhari/kitab/${b.number}`)} className="card flex items-baseline justify-between gap-3">
              <span>
                <span className="text-ink-muted tabular-nums">{b.number}. </span>
                {b.titleAr}
              </span>
              <span className="shrink-0 text-sm text-ink-muted tabular-nums">
                {b.firstNumber != null && (
                  <bdi dir="ltr">
                    {b.firstNumber}–{b.lastNumber}
                  </bdi>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
