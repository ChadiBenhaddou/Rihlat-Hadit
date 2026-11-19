import { Link } from 'react-router';
import { useI18n } from '~/i18n';

export function loader() {
  throw new Response('غير موجود', { status: 404 });
}

export default function NotFound() {
  const { t, to } = useI18n();
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">{t('الصفحة غير موجودة')}</h1>
      <Link className="link" to={to('/')}>
        {t('العودة إلى الرئيسية')}
      </Link>
    </main>
  );
}
