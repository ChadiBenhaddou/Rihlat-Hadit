import { Form, Link } from 'react-router';
import { KIND_AR, requireStaff } from '~/lib/admin.server';
import { listQueue } from '../../../server/admin/queries';
import type { Route } from './+types/queue';

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db } = await requireStaff(request, context);
  const u = new URL(request.url).searchParams;
  const status = (['open', 'resolved', 'dismissed'] as const).find((s) => s === u.get('status')) ?? 'open';
  const hadith = Number(u.get('hadith')) || undefined;
  return {
    q: { kind: u.get('kind') ?? '', status, hadith: hadith ?? '' },
    data: await listQueue(db, {
      kind: u.get('kind') || undefined,
      status,
      hadith,
      cursor: Number(u.get('cursor')) || 0,
    }),
  };
}

function summary(detail: Record<string, unknown>): string {
  return Object.entries(detail)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(' · ');
}

export default function Queue({ loaderData }: Route.ComponentProps) {
  const { q, data } = loaderData;
  const kinds = [...new Set(data.kinds.map((k) => k.kind))];
  return (
    <section className="space-y-3">
      <Form method="get" className="flex flex-wrap items-end gap-2 text-sm">
        <label>
          النوع
          <select name="kind" defaultValue={q.kind} className="select ms-1">
            <option value="">الكل</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {KIND_AR[k] ?? k}
              </option>
            ))}
          </select>
        </label>
        <label>
          الحالة
          <select name="status" defaultValue={q.status} className="select ms-1">
            <option value="open">مفتوح</option>
            <option value="resolved">محلول</option>
            <option value="dismissed">مستبعد</option>
          </select>
        </label>
        <label>
          رقم الحديث
          <input name="hadith" defaultValue={q.hadith} inputMode="numeric" className="select ms-1 w-24" />
        </label>
        <button className="btn">تصفية</button>
      </Form>
      <ul className="space-y-1">
        {data.items.map((i) => (
          <li key={i.id}>
            <Link
              to={`/admin/item/${i.id}`}
              className="card flex flex-wrap items-baseline justify-between gap-2 text-sm"
            >
              <span>
                <span className="badge me-2">{KIND_AR[i.kind] ?? i.kind}</span>
                {i.entity === 'hadith' && <span className="me-2 tabular-nums">رقم {i.entityId}</span>}
                <span className="text-ink-muted" dir="auto">
                  {summary(i.detail)}
                </span>
              </span>
              {i.pending > 0 && <span className="badge">مقترح بانتظار القرار</span>}
            </Link>
          </li>
        ))}
      </ul>
      {data.items.length === 0 && <p className="text-ink-muted">لا عناصر.</p>}
      {data.nextCursor != null && (
        <Link className="btn" to={`?kind=${q.kind}&status=${q.status}&hadith=${q.hadith}&cursor=${data.nextCursor}`}>
          التالي
        </Link>
      )}
    </section>
  );
}
