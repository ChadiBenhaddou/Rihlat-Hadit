import { Form, useActionData } from 'react-router';
import { requireStaff } from '~/lib/admin.server';
import { publish } from '../../../server/admin/proposals';
import { changesSincePublish } from '../../../server/admin/queries';
import type { Route } from './+types/publish';

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db } = await requireStaff(request, context, 'publish');
  return changesSincePublish(db);
}

export async function action({ request, context }: Route.ActionArgs) {
  const { db, env, staff } = await requireStaff(request, context, 'publish');
  const notes = String((await request.formData()).get('notes') ?? '').trim();
  if (notes.length < 3) return { label: null, error: 'اكتب ملاحظة عن هذا الإصدار.' };
  return { label: await publish(db, env, staff, notes), error: null };
}

export default function Publish({ loaderData }: Route.ComponentProps) {
  const { last, changes } = loaderData;
  const result = useActionData<typeof action>();
  return (
    <section className="space-y-3">
      <p className="text-sm">
        الإصدار الحالي: <span dir="ltr">{last?.label ?? '—'}</span>{' '}
        {last && <span className="text-ink-muted">({last.at})</span>}
      </p>
      <div className="pane">
        <h2 className="mb-2 font-semibold">التعديلات المطبّقة منذ آخر نشر</h2>
        {changes.length === 0 ? (
          <p className="text-ink-muted">لا تعديلات.</p>
        ) : (
          <ul className="text-sm">
            {changes.map((c) => (
              <li key={`${c.entity}.${c.field}`} className="flex justify-between">
                <span dir="ltr">
                  {c.entity}.{c.field}
                </span>
                <span className="tabular-nums">{c.n}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-ink-muted">
        النشر يرفع رقم الإصدار فتتجدد كل الذاكرات المؤقتة. فهرس البحث يُعاد بناؤه بخط البيانات، فتغييرات الأسماء تظهر في
        البحث بعد إعادة البناء.
      </p>
      {result?.label && (
        <p role="status" className="pane">
          نُشر الإصدار <span dir="ltr">{result.label}</span>.
        </p>
      )}
      {result?.error && <p role="alert">{result.error}</p>}
      <Form method="post" className="flex flex-wrap gap-2">
        <input name="notes" required minLength={3} className="select grow" placeholder="ملاحظات هذا الإصدار" />
        <button className="btn-primary">نشر</button>
      </Form>
    </section>
  );
}
