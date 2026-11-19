import { Form, Link, useActionData } from 'react-router';
import { KIND_AR, requireStaff } from '~/lib/admin.server';
import { handleProposalForm } from '~/lib/proposal-form.server';
import { getHadith } from '../../../server/data/hadith';
import { reviewItem } from '../../../server/admin/queries';
import type { Route } from './+types/item';

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const { db, staff } = await requireStaff(request, context);
  const item = await reviewItem(db, Number(params.id));
  if (!item) throw new Response('غير موجود', { status: 404 });
  let hadith = null;
  let links: {
    chainId: number;
    routeNo: number;
    position: number;
    narratorId: number | null;
    slug: string | null;
    name: string | null;
    mention: string;
    term: string | null;
    kind: string;
    resolution: string;
  }[] = [];
  if (item.entity === 'hadith' && item.entityId) {
    hadith = await getHadith(db, 'bukhari', item.entityId, 'admin');
    const { results } = await db
      .prepare(
        `SELECT c.id AS chainId, c.route_no AS routeNo, l.position, l.narrator_id AS narratorId, n.slug, n.display_name_ar AS name,
           l.mention_ar AS mention, l.term_ar AS term, l.link_kind AS kind, l.resolution
         FROM chains c JOIN chain_links l ON l.chain_id = c.id LEFT JOIN narrators n ON n.id = l.narrator_id
         WHERE c.hadith_id = ? ORDER BY c.route_no, l.position`,
      )
      .bind(item.entityId)
      .all<(typeof links)[number]>();
    links = results;
  }
  let narrator = null;
  if (item.entity === 'narrator' && item.entityId) {
    narrator = await db
      .prepare('SELECT id, slug, display_name_ar AS name, honorific_ar AS honorific FROM narrators WHERE id = ?')
      .bind(item.entityId)
      .first<{ id: number; slug: string; name: string; honorific: string | null }>();
  }
  return { item, hadith, links, narrator, role: staff.role };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const form = await request.formData();
  if (form.get('intent') === 'dismiss') {
    const { db } = await requireStaff(request, context, 'decide');
    await db.prepare("UPDATE review_items SET status = 'dismissed' WHERE id = ?").bind(Number(params.id)).run();
    return { ok: true, message: 'استُبعد العنصر.' };
  }
  const { db, staff } = await requireStaff(request, context, 'propose');
  return handleProposalForm(db, staff, form);
}

function Mentions({ text, spans }: { text: string; spans: { start: number; end: number }[] }) {
  const out: React.ReactNode[] = [];
  let c = 0;
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    if (s.start < c) continue;
    out.push(text.slice(c, s.start), <mark key={s.start}>{text.slice(s.start, s.end)}</mark>);
    c = s.end;
  }
  out.push(text.slice(c));
  return <p className="hadith-text">{out}</p>;
}

export default function Item({ loaderData }: Route.ComponentProps) {
  const { item, hadith, links, narrator, role } = loaderData;
  const result = useActionData<typeof action>();
  const routes = [...new Set(links.map((l) => l.chainId))];
  return (
    <section className="space-y-4">
      <div className="pane space-y-1">
        <h2 className="font-semibold">
          {KIND_AR[item.kind] ?? item.kind} <span className="badge">{item.status}</span>
        </h2>
        <pre className="overflow-x-auto text-xs" dir="ltr" lang="en">
          {JSON.stringify(item.detail, null, 2)}
        </pre>
        {item.entity === 'hadith' && (
          <Link className="link text-sm" to={`/bukhari/${item.entityId}`}>
            صفحة الحديث {item.entityId}
          </Link>
        )}
        {item.pending > 0 && <p className="text-sm">على هذا العنصر مقترح بانتظار القرار.</p>}
        {role !== 'editor' && item.status === 'open' && (
          <Form method="post">
            <button className="btn text-sm" name="intent" value="dismiss">
              استبعاد (لا يحتاج تعديلًا)
            </button>
          </Form>
        )}
      </div>
      {result && (
        <p role="status" className={`pane text-sm ${result.ok ? '' : 'font-semibold'}`}>
          {result.message}
        </p>
      )}

      {hadith && (
        <div className="pane space-y-3">
          <h3 className="font-semibold">محرّر الإسناد</h3>
          <Mentions
            text={hadith.isnadAr ?? hadith.textAr}
            spans={hadith.mentions.filter((m) => m.end <= (hadith.isnadAr ?? hadith.textAr).length)}
          />
          {routes.map((cid) => (
            <div key={cid} className="space-y-1">
              <h4 className="text-sm font-semibold">الطريق {links.find((l) => l.chainId === cid)?.routeNo}</h4>
              <table className="w-full text-sm">
                <thead className="text-ink-muted">
                  <tr>
                    <th className="text-start font-normal">#</th>
                    <th className="text-start font-normal">في النص</th>
                    <th className="text-start font-normal">الراوي</th>
                    <th className="text-start font-normal">اقتراح تعديل</th>
                  </tr>
                </thead>
                <tbody>
                  {links
                    .filter((l) => l.chainId === cid && l.position > 0)
                    .map((l) => (
                      <tr key={l.position} className="border-t border-hairline align-top">
                        <td className="py-1 tabular-nums">{l.position}</td>
                        <td className="py-1">
                          {l.term && <span className="text-ink-muted">{l.term} </span>}
                          {l.mention || <span className="text-ink-muted">غير مذكور في النص</span>}
                        </td>
                        <td className="py-1">
                          {l.slug ? (
                            <Link className="link" to={`/narrator/${l.slug}`}>
                              {l.name}
                            </Link>
                          ) : (
                            <span className="badge">غير محدَّد</span>
                          )}{' '}
                          <span className="text-xs text-ink-muted">
                            {l.kind} · {l.resolution}
                          </span>
                        </td>
                        <td className="py-1">
                          <details>
                            <summary className="cursor-pointer text-xs">تعديل</summary>
                            <Form method="post" className="mt-1 grid gap-1 text-xs">
                              <input type="hidden" name="intent" value="set_link" />
                              <input type="hidden" name="chainId" value={cid} />
                              <input type="hidden" name="position" value={l.position} />
                              <input type="hidden" name="reviewItemId" value={item.id} />
                              <label className="flex items-center gap-1">
                                <input type="checkbox" name="changeNarrator" value="1" /> تغيير الراوي إلى (معرّف مثل
                                r3443، أو فارغ = غير محدَّد)
                              </label>
                              <input name="narratorSlug" dir="ltr" className="select" placeholder="r…" />
                              <select name="linkKind" defaultValue="" className="select">
                                <option value="">نوع الرابط كما هو ({l.kind})</option>
                                <option value="connected">متصل</option>
                                <option value="suspended">معلّق</option>
                                <option value="gap">منقطع</option>
                                <option value="uncertain">غير مؤكد</option>
                              </select>
                              <input
                                name="termAr"
                                defaultValue={l.term ?? ''}
                                className="select"
                                placeholder="صيغة الأداء"
                              />
                              <textarea
                                name="reason"
                                required
                                minLength={5}
                                rows={2}
                                className="select"
                                placeholder="السبب والمصدر"
                              />
                              <button className="btn">اقتراح</button>
                            </Form>
                          </details>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}
          {routes.length === 0 && <p className="text-sm text-ink-muted">لا إسناد مستخرج لهذا الموضع.</p>}
        </div>
      )}

      {narrator && (
        <div className="pane space-y-2">
          <h3 className="font-semibold">
            <Link className="link" to={`/admin/narrator/${narrator.slug}`}>
              {narrator.name}
            </Link>
          </h3>
          <Form method="post" className="grid max-w-md gap-1 text-sm">
            <input type="hidden" name="intent" value="set_field" />
            <input type="hidden" name="entity" value="narrator" />
            <input type="hidden" name="id" value={narrator.id} />
            <input type="hidden" name="field" value="honorific_ar" />
            <input type="hidden" name="reviewItemId" value={item.id} />
            <label>
              صيغة الترضّي
              <select name="value" defaultValue={narrator.honorific ?? ''} className="select ms-1">
                <option value="">بلا</option>
                <option value="رضي الله عنه">رضي الله عنه</option>
                <option value="رضي الله عنها">رضي الله عنها</option>
                <option value="رضي الله عنهما">رضي الله عنهما</option>
              </select>
            </label>
            <textarea name="reason" required minLength={5} rows={2} className="select" placeholder="مصدر ثبوت الصحبة" />
            <button className="btn">اقتراح</button>
          </Form>
        </div>
      )}
    </section>
  );
}
