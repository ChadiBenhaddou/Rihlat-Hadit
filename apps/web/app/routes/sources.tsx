import type { SourceInfo } from '@isnad/shared';
import { dataContext } from '~/lib/data.server';
import { ALL_SOURCES_SQL } from '../../server/data/common';
import type { Route } from './+types/sources';
import { useI18n } from '~/i18n';
import { localeOf, translate } from '~/i18n';

export async function loader({ context }: Route.LoaderArgs) {
  const { db } = await dataContext(context);
  const { results } = await db.prepare(ALL_SOURCES_SQL).all<SourceInfo>();
  return { sources: results };
}

export function meta({ location }: Route.MetaArgs) {
  return [{ title: translate(localeOf(location.pathname), 'المصادر وتراخيصها | رحلة الحديث') }];
}

const KIND_AR: Record<string, string> = {
  primary_text: 'نص أصلي',
  biographical: 'كتاب تراجم',
  critical: 'كتاب جرح وتعديل',
  dataset: 'قاعدة بيانات (مصدر ثانوي)',
  web: 'موقع',
};

export default function Sources({ loaderData }: Route.ComponentProps) {
  const { t } = useI18n();
  return (
    <main id="main" className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('المصادر وتراخيصها')}</h1>
      <p className="text-ink-muted">
        {t('كل معلومة في الموقع تحيل إلى أحد هذه المصادر. تُذكر صيغة الإسناد المطلوبة في الترخيص كما هي.')}
      </p>
      <ul className="space-y-4">
        {loaderData.sources.map((s) => (
          <li key={s.slug} className="pane space-y-1">
            <h2 className="font-semibold">{s.titleAr}</h2>
            {s.titleEn && (
              <p className="text-sm text-ink-muted" dir="ltr" lang="en">
                {s.titleEn}
              </p>
            )}
            <p className="text-sm">
              {t('النوع:')} {t(KIND_AR[s.kind]) || s.kind}
            </p>
            {s.edition && (
              <p className="text-sm">
                {t('الطبعة والنسخة:')} {s.edition}
              </p>
            )}
            <p className="text-sm">
              {t('الترخيص:')}{' '}
              <span dir="ltr" lang="en">
                {s.license}
              </span>
            </p>
            {s.attribution && (
              <p className="text-sm">
                {t('الإسناد المطلوب:')}{' '}
                <span dir="ltr" lang="en">
                  {s.attribution}
                </span>
              </p>
            )}
            {s.url && (
              <a className="link text-sm" href={s.url} rel="noopener noreferrer" target="_blank" dir="ltr">
                {s.url}
              </a>
            )}
          </li>
        ))}
      </ul>
      <section className="space-y-1 text-sm text-ink-muted">
        <h2 className="font-semibold text-ink">{t('الخطوط')}</h2>
        <p>
          {t(
            'خط Amiri لنصوص الحديث وخط IBM Plex Sans Arabic للواجهة، وكلاهما برخصة SIL Open Font License، ويُستضافان على هذا الموقع.',
          )}
        </p>
      </section>
    </main>
  );
}
