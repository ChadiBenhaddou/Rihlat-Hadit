import { Form, Link } from 'react-router';
import { requireStaff } from '~/lib/admin.server';
import { listReports } from '../../../server/admin/queries';
import type { Route } from './+types/reports';

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db } = await requireStaff(request, context);
  return {
    reports: (await listReports(db)) as {
      id: number;
      entity: string;
      entityId: number;
      message: string;
      contact: string | null;
      status: string;
      createdAt: string;
    }[],
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { db } = await requireStaff(request, context, 'decide');
  const f = await request.formData();
  const status = String(f.get('status'));
  if (!['open', 'accepted', 'rejected', 'duplicate'].includes(status))
    throw new Response('حالة غير صالحة', { status: 400 });
  await db
    .prepare('UPDATE reports SET status = ? WHERE id = ?')
    .bind(status, Number(f.get('id')))
    .run();
  return null;
}

export default function Reports({ loaderData }: Route.ComponentProps) {
  return (
    <ul className="space-y-2">
      {loaderData.reports.map((r) => (
        <li key={r.id} className="pane space-y-1 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <Link className="link" to={r.entity === 'hadith' ? `/bukhari/${r.entityId}` : `/admin/queue`}>
              {r.entity === 'hadith' ? `الحديث ${r.entityId}` : `الراوي ${r.entityId}`}
            </Link>
            <span className="badge">{r.status}</span>
          </div>
          <p className="whitespace-pre-wrap">{r.message}</p>
          {r.contact && (
            <p className="text-ink-muted" dir="ltr">
              {r.contact}
            </p>
          )}
          <Form method="post" className="flex flex-wrap gap-1">
            <input type="hidden" name="id" value={r.id} />
            {(['accepted', 'rejected', 'duplicate', 'open'] as const).map((s) => (
              <button key={s} className="btn text-xs" name="status" value={s}>
                {{ accepted: 'مقبول', rejected: 'مرفوض', duplicate: 'مكرر', open: 'إعادة فتح' }[s]}
              </button>
            ))}
          </Form>
        </li>
      ))}
      {loaderData.reports.length === 0 && <p className="text-ink-muted">لا بلاغات.</p>}
    </ul>
  );
}
