import { Form, Link, useActionData } from 'react-router';
import { requireStaff } from '~/lib/admin.server';
import { handleProposalForm } from '~/lib/proposal-form.server';
import type { Route } from './+types/narrator';

const FIELDS: { field: string; label: string; type: 'text' | 'int' }[] = [
  { field: 'display_name_ar', label: 'الاسم المعروض', type: 'text' },
  { field: 'honorific_ar', label: 'صيغة الترضّي/الصلاة', type: 'text' },
  { field: 'tabaqa', label: 'الطبقة', type: 'int' },
  { field: 'birth_ah', label: 'سنة المولد (هـ)', type: 'int' },
  { field: 'death_ah', label: 'سنة الوفاة (هـ)', type: 'int' },
  { field: 'death_ah_max', label: 'أقصى سنة وفاة مروية (هـ)', type: 'int' },
  { field: 'review_status', label: 'حالة المراجعة (auto / in_review / reviewed / rejected)', type: 'text' },
];

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const { db } = await requireStaff(request, context);
  const n = await db
    .prepare('SELECT * FROM narrators WHERE slug = ?')
    .bind(params.slug)
    .first<Record<string, string | number | null>>();
  if (!n) throw new Response('غير موجود', { status: 404 });
  const { results: sources } = await db
    .prepare('SELECT slug, title_ar AS titleAr, kind FROM sources ORDER BY id')
    .all<{ slug: string; titleAr: string; kind: string }>();
  return { n, sources };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { db, staff } = await requireStaff(request, context, 'propose');
  return handleProposalForm(db, staff, await request.formData());
}

export default function AdminNarrator({ loaderData }: Route.ComponentProps) {
  const { n, sources } = loaderData;
  const result = useActionData<typeof action>();
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">
        <Link className="link" to={`/narrator/${n.slug}`}>
          {n.display_name_ar}
        </Link>{' '}
        <span className="text-sm text-ink-muted" dir="ltr">
          {n.slug}
        </span>
      </h2>
      {result && (
        <p role="status" className="pane text-sm">
          {result.message}
        </p>
      )}
      <div className="pane space-y-2">
        <h3 className="font-semibold">تعديل حقل</h3>
        {FIELDS.map((f) => (
          <Form key={f.field} method="post" className="flex flex-wrap items-end gap-2 text-sm">
            <input type="hidden" name="intent" value="set_field" />
            <input type="hidden" name="entity" value="narrator" />
            <input type="hidden" name="id" value={n.id ?? ''} />
            <input type="hidden" name="field" value={f.field} />
            <input type="hidden" name="valueType" value={f.type} />
            <label className="grow">
              {f.label}
              <input
                name="value"
                defaultValue={n[f.field] ?? ''}
                className="select ms-1"
                inputMode={f.type === 'int' ? 'numeric' : undefined}
              />
            </label>
            <input name="reason" required minLength={5} className="select grow" placeholder="السبب والمصدر" />
            <button className="btn">اقتراح</button>
          </Form>
        ))}
      </div>
      <div className="pane space-y-2">
        <h3 className="font-semibold">إضافة إحالة إلى مصدر</h3>
        <p className="text-xs text-ink-muted">
          إحالة التواريخ إلى مصدر أصلي تزيل وسم «مصدر ثانوي» عنها. إحالة خلاصة الحكم تجعلها تظهر للقراء، فلا تُعرض خلاصة
          بلا قائل.
        </p>
        <Form method="post" className="grid max-w-xl gap-1 text-sm">
          <input type="hidden" name="intent" value="add_citation" />
          <input type="hidden" name="narratorId" value={n.id ?? ''} />
          <label>
            الحقل
            <select name="target" className="select ms-1">
              <option value="dates">التواريخ والطبقة</option>
              <option value="summary_grade">خلاصة الحكم{n.summary_grade_ar ? `: ${n.summary_grade_ar}` : ''}</option>
            </select>
          </label>
          <label>
            المصدر
            <select name="sourceSlug" className="select ms-1">
              {sources.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.titleAr}
                </option>
              ))}
            </select>
          </label>
          <details>
            <summary className="cursor-pointer text-xs">أو مصدر جديد</summary>
            <div className="mt-1 grid gap-1">
              <input name="sourceSlug" dir="ltr" className="select" placeholder="slug, e.g. taqrib-al-tahdhib" />
              <input name="newTitle" className="select" placeholder="عنوان الكتاب" />
              <input name="newEdition" className="select" placeholder="الطبعة والمحقق" />
              <select name="newKind" className="select">
                <option value="biographical">كتاب تراجم</option>
                <option value="critical">كتاب جرح وتعديل</option>
                <option value="primary_text">نص أصلي</option>
              </select>
              <input name="newLicense" dir="ltr" className="select" placeholder="licence, e.g. public-domain" />
            </div>
          </details>
          <input name="locator" required className="select" placeholder="الموضع: الجزء والصفحة أو رقم الترجمة" />
          <input name="url" dir="ltr" className="select" placeholder="https://… (اختياري)" />
          <textarea name="reason" required minLength={5} rows={2} className="select" placeholder="السبب" />
          <button className="btn">اقتراح</button>
        </Form>
      </div>
      <div className="pane space-y-2">
        <h3 className="font-semibold">دمج راويين</h3>
        <p className="text-xs text-ink-muted">
          ينقل كل روايات هذا الراوي وأقواله وأسمائه إلى الراوي الهدف، ويبقى معرّفه القديم يحيل إليه.
        </p>
        <Form method="post" className="flex flex-wrap items-end gap-2 text-sm">
          <input type="hidden" name="intent" value="merge" />
          <input type="hidden" name="from" value={String(n.slug)} />
          <label>
            ادمجه في
            <input name="into" required dir="ltr" className="select ms-1" placeholder="r…" />
          </label>
          <input name="reason" required minLength={5} className="select grow" placeholder="الدليل على أنهما شخص واحد" />
          <button className="btn">اقتراح</button>
        </Form>
      </div>
    </section>
  );
}
