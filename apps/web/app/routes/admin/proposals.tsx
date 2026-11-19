import { Form, Link, useActionData } from 'react-router';
import { requireStaff } from '~/lib/admin.server';
import { handleProposalForm } from '~/lib/proposal-form.server';
import { listProposals } from '../../../server/admin/queries';
import type { Route } from './+types/proposals';

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db, staff } = await requireStaff(request, context);
  const status =
    (['pending', 'applied', 'rejected'] as const).find((s) => s === new URL(request.url).searchParams.get('status')) ??
    'pending';
  return { status, proposals: await listProposals(db, status), me: staff };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { db, staff } = await requireStaff(request, context, 'decide');
  return handleProposalForm(db, staff, await request.formData());
}

const KIND_AR: Record<string, string> = {
  set_field: 'تعديل حقل',
  set_link: 'تعديل رابط',
  merge_narrators: 'دمج راويين',
  add_citation: 'إحالة إلى مصدر',
};

export default function Proposals({ loaderData }: Route.ComponentProps) {
  const { status, proposals, me } = loaderData;
  const result = useActionData<typeof action>();
  return (
    <section className="space-y-3">
      <nav className="inline-flex rounded-md border border-hairline text-sm">
        {(['pending', 'applied', 'rejected'] as const).map((s) => (
          <Link key={s} to={`?status=${s}`} className={`seg${status === s ? ' seg-on' : ''}`}>
            {{ pending: 'بانتظار القرار', applied: 'مطبّقة', rejected: 'مرفوضة' }[s]}
          </Link>
        ))}
      </nav>
      {result && (
        <p role="status" className="pane text-sm">
          {result.message}
        </p>
      )}
      <ul className="space-y-2">
        {proposals.map((p) => {
          const r = p as unknown as {
            id: number;
            kind: string;
            payload: unknown;
            reason: string;
            proposedBy: string;
            decidedBy: string | null;
            reviewItemId: number | null;
          };
          const own = r.proposedBy === me.email && me.role !== 'admin';
          return (
            <li key={r.id} className="pane space-y-1 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-semibold">
                  #{r.id} {KIND_AR[r.kind] ?? r.kind}
                </span>
                <span className="text-ink-muted" dir="auto">
                  {r.proposedBy}
                  {r.decidedBy ? ` ← ${r.decidedBy}` : ''}
                </span>
              </div>
              <pre className="overflow-x-auto text-xs" dir="ltr" lang="en">
                {JSON.stringify(r.payload, null, 2)}
              </pre>
              <p>السبب: {r.reason}</p>
              {r.reviewItemId && (
                <Link className="link text-xs" to={`/admin/item/${r.reviewItemId}`}>
                  عنصر المراجعة
                </Link>
              )}
              {status === 'pending' && me.role !== 'editor' && (
                <Form method="post" className="flex gap-2">
                  <input type="hidden" name="intent" value="decide" />
                  <input type="hidden" name="proposalId" value={r.id} />
                  <button
                    className="btn-primary"
                    name="approve"
                    value="1"
                    disabled={own}
                    title={own ? 'يقرّر المقترحَ غيرُ صاحبه' : undefined}
                  >
                    اعتماد وتطبيق
                  </button>
                  <button className="btn" name="approve" value="0" disabled={own}>
                    رفض
                  </button>
                </Form>
              )}
            </li>
          );
        })}
      </ul>
      {proposals.length === 0 && <p className="text-ink-muted">لا مقترحات.</p>}
    </section>
  );
}
