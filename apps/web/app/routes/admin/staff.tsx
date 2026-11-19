import { Form } from 'react-router';
import { ROLE_AR } from '~/lib/admin-labels';
import { requireStaff } from '~/lib/admin.server';
import type { Route } from './+types/staff';

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db, staff } = await requireStaff(request, context, 'manage_staff');
  const { results } = await db
    .prepare('SELECT email, role FROM staff ORDER BY role, email')
    .all<{ email: string; role: string }>();
  return { staff: results, me: staff.email };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { db, staff } = await requireStaff(request, context, 'manage_staff');
  const f = await request.formData();
  const email = String(f.get('email') ?? '')
    .trim()
    .toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new Response('بريد غير صالح', { status: 400 });
  if (f.get('intent') === 'remove') {
    if (email === staff.email) throw new Response('لا يمكنك حذف نفسك', { status: 409 });
    await db.prepare('DELETE FROM staff WHERE email = ?').bind(email).run();
  } else {
    const role = String(f.get('role'));
    if (!['editor', 'reviewer', 'admin'].includes(role)) throw new Response('دور غير صالح', { status: 400 });
    await db.prepare('INSERT OR REPLACE INTO staff (email, role) VALUES (?, ?)').bind(email, role).run();
  }
  return null;
}

export default function Staff({ loaderData }: Route.ComponentProps) {
  return (
    <section className="space-y-3">
      <ul className="space-y-1 text-sm">
        {loaderData.staff.map((s) => (
          <li key={s.email} className="card flex items-center justify-between gap-2">
            <span dir="ltr">{s.email}</span>
            <span className="flex items-center gap-2">
              {ROLE_AR[s.role]}
              {s.email !== loaderData.me && (
                <Form method="post">
                  <input type="hidden" name="email" value={s.email} />
                  <button className="btn text-xs" name="intent" value="remove">
                    إزالة
                  </button>
                </Form>
              )}
            </span>
          </li>
        ))}
      </ul>
      <Form method="post" className="flex flex-wrap items-end gap-2 text-sm">
        <input name="email" type="email" required dir="ltr" className="select" placeholder="email@example.org" />
        <select name="role" className="select">
          <option value="editor">محرر</option>
          <option value="reviewer">مراجع</option>
          <option value="admin">مدير</option>
        </select>
        <button className="btn">إضافة أو تغيير الدور</button>
      </Form>
      <p className="text-xs text-ink-muted">
        أضف البريد نفسه إلى سياسة تطبيق Cloudflare Access حتى يستطيع صاحبه الدخول.
      </p>
    </section>
  );
}
