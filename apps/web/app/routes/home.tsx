import type { Route } from './+types/home';

export function meta(_: Route.MetaArgs) {
  return [
    { title: 'رحلة الحديث في صحيح البخاري' },
    { name: 'description', content: 'منصة بحثية لاستكشاف أسانيد صحيح البخاري.' },
  ];
}

/**
 * Phase 0 holding page. It states only what the platform is and that no data
 * is loaded yet; the search box and the featured journey arrive in Phase 2.
 */
export default function Home() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold">رحلة الحديث في صحيح البخاري</h1>
      <p className="mt-4 text-lg leading-loose text-ink-muted">
        منصة بحثية تعرض الإسناد مخططًا تفاعليًا يمكن تتبّعه راويًا راويًا، مع توثيق كل معلومة بمصدرها وبيان حالة مراجعتها.
      </p>
      <p className="mt-6 rounded border border-hairline bg-surface p-4 text-ink-muted">
        المنصة قيد الإنشاء، ولم تُحمَّل أي بيانات بعد.
      </p>
    </main>
  );
}
