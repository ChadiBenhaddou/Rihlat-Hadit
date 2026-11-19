import { NavLink, Outlet } from 'react-router';
import { ROLE_AR } from '~/lib/admin-labels';
import { requireStaff } from '~/lib/admin.server';
import type { Route } from './+types/layout';

export async function loader({ request, context }: Route.LoaderArgs) {
  const { staff } = await requireStaff(request, context);
  return { staff };
}

export function meta() {
  return [{ title: 'أدوات التحرير | رحلة الحديث' }, { name: 'robots', content: 'noindex, nofollow' }];
}

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const { staff } = loaderData;
  const link = (to: string, label: string, end = false) => (
    <NavLink to={to} end={end} className={({ isActive }) => `seg${isActive ? ' seg-on' : ''}`}>
      {label}
    </NavLink>
  );
  return (
    <main id="main" className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">أدوات التحرير</h1>
        <span className="text-sm text-ink-muted" dir="auto">
          {staff.email} · {ROLE_AR[staff.role]}
        </span>
      </header>
      <nav className="inline-flex flex-wrap rounded-md border border-hairline" aria-label="أقسام التحرير">
        {link('/admin', 'اللوحة', true)}
        {link('/admin/queue', 'قائمة المراجعة')}
        {link('/admin/proposals', 'المقترحات')}
        {link('/admin/reports', 'البلاغات')}
        {staff.role === 'admin' && link('/admin/staff', 'الفريق')}
        {staff.role === 'admin' && link('/admin/publish', 'النشر')}
      </nav>
      <Outlet />
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const msg = error instanceof Response ? '' : String((error as Error)?.message ?? '');
  const status = (error as { status?: number })?.status;
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-xl font-semibold">
        {status === 401 ? 'يلزم تسجيل الدخول' : status === 403 ? 'غير مسموح' : 'تعذّر فتح الصفحة'}
      </h1>
      <p className="mt-2 text-ink-muted">
        {status === 401
          ? 'أدوات التحرير خلف Cloudflare Access، ولا يدخلها إلا من في جدول الفريق.'
          : status === 403
            ? 'هذا الإجراء ليس من صلاحيات دورك.'
            : msg}
      </p>
    </main>
  );
}
