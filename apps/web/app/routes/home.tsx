import { Link } from 'react-router';
import { SearchBox } from '~/components/SearchBox';
import { localeOf, translate, useI18n } from '~/i18n';
import { dataContext } from '~/lib/data.server';
import { listBooks } from '../../server/data/books';
import type { Route } from './+types/home';

/** New visitors rarely know a hadith by heart, so the books come first (one D1 batch). */
export async function loader({ context }: Route.LoaderArgs) {
  const { db, dataVersion } = await dataContext(context);
  const books = await listBooks(db, 'bukhari', dataVersion);
  return { books: books?.books ?? [] };
}

export function meta({ location }: Route.MetaArgs) {
  const l = localeOf(location.pathname);
  return [
    { title: translate(l, 'رحلة الحديث في صحيح البخاري') },
    {
      name: 'description',
      content: translate(
        l,
        'منصة بحثية تعرض أسانيد صحيح البخاري مخططًا تفاعليًا موثَّقًا: تتبّع الإسناد راويًا راويًا، واستكشف طرق الحديث ورواته.',
      ),
    },
  ];
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { t, to } = useI18n();
  const { books } = loaderData;
  const total = books.reduce((n, b) => n + b.hadithCount, 0);
  return (
    <main id="main" className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      {/* 1. What this is, and the one obvious way in. */}
      <section className="max-w-3xl space-y-4">
        <h1 className="text-3xl font-semibold">{t('رحلة الحديث في صحيح البخاري')}</h1>
        <p className="text-lg leading-loose text-ink-muted">
          {t(
            'اقرأ الإسناد مخططًا: شاهِد الحديث ينتقل من النبي ﷺ إلى الصحابي فالتابعين فمن بعدهم حتى البخاري، مع صيغة الأداء في كل رابط، ومصدر كل معلومة وحالة مراجعتها.',
          )}
        </p>
        <div className="flex flex-wrap gap-3">
          <a className="btn-primary px-5 py-3 text-lg" href="#books">
            {t('تصفّح كتب الصحيح')}
          </a>
          <Link className="btn px-5 py-3 text-lg" to={to('/bukhari/1?mode=journey&dir=trace&step=0')}>
            {t('ابدأ برحلة الحديث الأول')}
          </Link>
        </div>
      </section>

      {/* 2. The books themselves, right here. */}
      <section id="books" aria-labelledby="books-title" className="scroll-mt-6 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="books-title" className="text-2xl font-semibold">
            {t('كتب صحيح البخاري')}
          </h2>
          <p className="text-sm text-ink-muted">
            {t('{b} كتابًا · {h} حديثًا محمّلًا · اختر كتابًا لترى أبوابه وأحاديثه', { b: books.length, h: total })}
          </p>
        </div>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((b) => (
            <li key={b.number}>
              <Link to={to(`/bukhari/kitab/${b.number}`)} className="card book-card flex h-full flex-col gap-1">
                <span className="flex items-baseline gap-2">
                  <span className="tabular-nums text-sm text-ink-muted">{b.number}</span>
                  <span className="font-semibold" lang="ar">
                    {b.titleAr}
                  </span>
                </span>
                <span className="text-xs text-ink-muted">
                  {t('{h} حديثًا', { h: b.hadithCount })}
                  {b.firstNumber != null && (
                    <>
                      {' · '}
                      {/* A numeric range reads left to right even on an RTL page. */}
                      <bdi dir="ltr">
                        {b.firstNumber}–{b.lastNumber}
                      </bdi>
                    </>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* 3. A guided first journey. */}
      <section className="pane max-w-3xl space-y-3">
        <h2 className="text-xl font-semibold">{t('رحلة مقترحة: «إنما الأعمال بالنيات»')}</h2>
        <p className="text-ink-muted">
          {t('الحديث الأول في الصحيح. ابدأ من البخاري وتتبّع الإسناد صعودًا، أو انطلق من المصدر نزولًا.')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-primary" to={to('/bukhari/1?mode=journey&dir=trace&step=0')}>
            {t('تتبّع الإسناد')}
          </Link>
          <Link className="btn" to={to('/bukhari/1?mode=journey&dir=journey&step=0')}>
            {t('رحلة النقل')}
          </Link>
        </div>
      </section>

      {/* 4. Search, for those who already know a wording or a number. */}
      <section className="max-w-3xl space-y-2">
        <h2 className="text-xl font-semibold">{t('تعرف لفظًا أو رقمًا؟')}</h2>
        <SearchBox />
      </section>

      <section className="max-w-3xl space-y-3">
        <h2 className="text-xl font-semibold">{t('ما الإسناد؟')}</h2>
        <p className="leading-loose">
          {t(
            'الإسناد سلسلة الرواة الذين نقلوا الحديث، يذكر كل واحد منهم من حدّثه به، بصيغة تبيّن طريقة التحمّل مثل «حدثنا» و«أخبرنا» و«عن» و«سمعت». يعرض هذا الموقع كل سلسلة رابطًا رابطًا، ويرسم الطرق المعلّقة والمنقطعة بخط متقطع لا متصل، ولا يُصدر حكمًا على صحة حديث: يعرض أقوال العلماء المسمَّين بمصادرها، والمؤشرات الحسابية مساعدةً للباحث فقط.',
          )}
        </p>
        <p className="flex flex-wrap gap-4">
          <Link className="link" to={to('/methodology')}>
            {t('منهجية المنصة')}
          </Link>
          <Link className="link" to={to('/sources')}>
            {t('المصادر وتراخيصها')}
          </Link>
        </p>
      </section>
    </main>
  );
}
