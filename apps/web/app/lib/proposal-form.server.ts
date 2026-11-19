/** Turn an admin form submission into a validated proposal (or a decision). */
import { decide, propose, validateProposal } from '../../server/admin/proposals';
import type { Staff } from '../../server/admin/access';

type Session = D1DatabaseSession;

const num = (v: FormDataEntryValue | null) => (v == null || v === '' ? null : Number(v));
const str = (v: FormDataEntryValue | null) => (v == null ? null : String(v).trim());

export async function handleProposalForm(
  db: Session,
  staff: Staff,
  form: FormData,
): Promise<{ ok: boolean; message: string }> {
  const intent = String(form.get('intent'));
  const reason = str(form.get('reason')) ?? '';
  const item = num(form.get('reviewItemId'));
  if (intent === 'decide') {
    const r = await decide(db, staff, Number(form.get('proposalId')), form.get('approve') === '1');
    return r.ok ? { ok: true, message: 'سُجّل القرار.' } : { ok: false, message: r.error };
  }
  if (reason.length < 5) return { ok: false, message: 'اكتب سببًا للتعديل (خمسة أحرف على الأقل).' };
  let input: unknown;
  if (intent === 'set_link') {
    const slug = str(form.get('narratorSlug'));
    input = {
      kind: 'set_link',
      payload: {
        chainId: Number(form.get('chainId')),
        position: Number(form.get('position')),
        ...(form.get('changeNarrator') === '1' ? { narratorSlug: slug ? slug : null } : {}),
        ...(form.get('linkKind') ? { linkKind: String(form.get('linkKind')) } : {}),
        ...(form.has('termAr') ? { termAr: str(form.get('termAr')) || null } : {}),
      },
    };
  } else if (intent === 'set_field') {
    const raw = form.get('value');
    const kind = String(form.get('valueType') ?? 'text');
    const value = raw === '' ? null : kind === 'int' ? Number(raw) : String(raw).trim();
    input = {
      kind: 'set_field',
      payload: {
        entity: String(form.get('entity')),
        id: Number(form.get('id')),
        field: String(form.get('field')),
        value,
      },
    };
  } else if (intent === 'merge') {
    input = { kind: 'merge_narrators', payload: { from: str(form.get('from')), into: str(form.get('into')) } };
  } else if (intent === 'add_citation') {
    const title = str(form.get('newTitle'));
    input = {
      kind: 'add_citation',
      payload: {
        narratorId: Number(form.get('narratorId')),
        target: String(form.get('target')),
        sourceSlug: str(form.get('sourceSlug')),
        locator: str(form.get('locator')),
        ...(str(form.get('url')) ? { url: str(form.get('url')) } : {}),
        ...(title
          ? {
              newSource: {
                kind: String(form.get('newKind') ?? 'biographical'),
                titleAr: title,
                license: str(form.get('newLicense')) ?? 'unknown',
                ...(str(form.get('newEdition')) ? { edition: str(form.get('newEdition')) } : {}),
              },
            }
          : {}),
      },
    };
  } else return { ok: false, message: 'إجراء غير معروف' };
  const v = validateProposal(input);
  if (!v.ok) return { ok: false, message: v.error };
  const id = await propose(db, staff, v.value, reason, item);
  return { ok: true, message: `سُجّل المقترح رقم ${id}، وينتظر قرار مراجع.` };
}
