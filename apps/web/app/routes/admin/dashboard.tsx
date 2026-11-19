import { Link } from 'react-router';
import { KIND_AR } from '~/lib/admin-labels';
import { requireStaff } from '~/lib/admin.server';
import type { Route } from './+types/dashboard';

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db } = await requireStaff(request, context);
  const [kinds, props, reports] = await db.batch([
    db.prepare("SELECT kind, COUNT(*) AS n FROM review_items WHERE status = 'open' GROUP BY kind ORDER BY n DESC"),
    db.prepare("SELECT COUNT(*) AS n FROM proposals WHERE status = 'pending'"),
    db.prepare("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'"),
  ]);
  return {
    kinds: (kinds?.results ?? []) as { kind: string; n: number }[],
    pending: ((props?.results?.[0] ?? { n: 0 }) as { n: number }).n,
    reports: ((reports?.results?.[0] ?? { n: 0 }) as { n: number }).n,
  };
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { kinds, pending, reports } = loaderData;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <section className="pane md:col-span-2">
        <h2 className="mb-2 font-semibold">عناصر مفتوحة للمراجعة</h2>
        <ul className="space-y-1 text-sm">
          {kinds.map((k) => (
            <li key={k.kind} className="flex justify-between">
              <Link className="link" to={`/admin/queue?kind=${k.kind}`}>
                {KIND_AR[k.kind] ?? k.kind}
              </Link>
              <span className="tabular-nums">{k.n}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="pane space-y-2">
        <p>
          <Link className="link" to="/admin/proposals">
            مقترحات بانتظار القرار
          </Link>
          : <span className="tabular-nums">{pending}</span>
        </p>
        <p>
          <Link className="link" to="/admin/reports">
            بلاغات مفتوحة
          </Link>
          : <span className="tabular-nums">{reports}</span>
        </p>
      </section>
    </div>
  );
}
