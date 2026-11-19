/**
 * The editorial flow (SPEC §14): an editor proposes a change with a written
 * reason; a reviewer (not the proposer, unless an admin) approves or rejects
 * it. An approved change applies in ONE D1 batch and writes one `revisions` row
 * per changed field. Derived data (`transmissions`) is rebuilt in the same batch.
 */
import { z } from 'zod';
import type { Staff } from './access';

type Session = D1DatabaseSession;

/** Editable fields per entity. Nothing outside this list can be changed through the tools. */
const FIELDS = {
  narrator: {
    honorific_ar: z.string().trim().max(40).nullable(),
    review_status: z.enum(['auto', 'in_review', 'reviewed', 'rejected']),
    display_name_ar: z.string().trim().min(1).max(200),
    tabaqa: z.number().int().min(0).max(30).nullable(),
    birth_ah: z.number().int().min(-60).max(1500).nullable(),
    death_ah: z.number().int().min(0).max(1500).nullable(),
    death_ah_max: z.number().int().min(0).max(1500).nullable(),
  },
  hadith: {
    review_status: z.enum(['auto', 'in_review', 'reviewed', 'rejected']),
    chapter_id: z.number().int().positive().nullable(),
  },
  chain: {
    review_status: z.enum(['auto', 'in_review', 'reviewed', 'rejected']),
    terminus: z.enum(['prophet', 'companion', 'successor', 'other']),
  },
} as const;
const TABLE = { narrator: 'narrators', hadith: 'hadiths', chain: 'chains' } as const;

export const SetField = z.object({
  entity: z.enum(['narrator', 'hadith', 'chain']),
  id: z.number().int().positive(),
  field: z.string(),
  value: z.unknown(),
});
export const SetLink = z.object({
  chainId: z.number().int().positive(),
  position: z.number().int().min(1),
  /** A narrator slug, null to mark the mention unresolved, or omitted to keep it. */
  narratorSlug: z
    .string()
    .regex(/^[a-z0-9-]{1,64}$/)
    .nullable()
    .optional(),
  linkKind: z.enum(['connected', 'suspended', 'gap', 'uncertain']).optional(),
  termAr: z.string().trim().max(40).nullable().optional(),
});
export const MergeNarrators = z.object({
  from: z.string().regex(/^[a-z0-9-]{1,64}$/),
  into: z.string().regex(/^[a-z0-9-]{1,64}$/),
});
export const AddCitation = z.object({
  narratorId: z.number().int().positive(),
  target: z.enum(['dates', 'summary_grade']),
  sourceSlug: z.string().regex(/^[a-z0-9-]{1,64}$/),
  /** A new source to create when sourceSlug is not yet known. */
  newSource: z
    .object({
      kind: z.enum(['primary_text', 'biographical', 'critical', 'dataset', 'web']),
      titleAr: z.string().trim().min(2).max(300),
      edition: z.string().trim().max(500).optional(),
      license: z.string().trim().min(2).max(80),
      url: z.string().url().max(500).optional(),
    })
    .optional(),
  locator: z.string().trim().min(1).max(200),
  url: z.string().url().max(500).optional(),
});

export const ProposalInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('set_field'), payload: SetField }),
  z.object({ kind: z.literal('set_link'), payload: SetLink }),
  z.object({ kind: z.literal('merge_narrators'), payload: MergeNarrators }),
  z.object({ kind: z.literal('add_citation'), payload: AddCitation }),
]);
export type ProposalInput = z.infer<typeof ProposalInput>;

export function validateProposal(input: unknown): { ok: true; value: ProposalInput } | { ok: false; error: string } {
  const p = ProposalInput.safeParse(input);
  if (!p.success) return { ok: false, error: 'invalid proposal' };
  if (p.data.kind === 'set_field') {
    const fields = FIELDS[p.data.payload.entity] as Record<string, z.ZodType>;
    const schema = fields[p.data.payload.field];
    if (!schema) return { ok: false, error: `field ${p.data.payload.field} is not editable` };
    const v = schema.safeParse(p.data.payload.value);
    if (!v.success) return { ok: false, error: `invalid value for ${p.data.payload.field}` };
    p.data.payload.value = v.data;
  }
  if (p.data.kind === 'merge_narrators' && p.data.payload.from === p.data.payload.into)
    return { ok: false, error: 'cannot merge a narrator into itself' };
  return { ok: true, value: p.data };
}

export async function propose(
  db: Session,
  staff: Staff,
  input: ProposalInput,
  reason: string,
  reviewItemId: number | null,
): Promise<number> {
  const row = await db
    .prepare(
      'INSERT INTO proposals (review_item_id, kind, payload, reason, proposed_by) VALUES (?, ?, ?, ?, ?) RETURNING id',
    )
    .bind(reviewItemId, input.kind, JSON.stringify(input.payload), reason, staff.email)
    .first<{ id: number }>();
  return row!.id;
}

/** Derived data: rebuilt from chain_links, never edited (SPEC §7). */
const REBUILD_TRANSMISSIONS = [
  'DELETE FROM transmissions',
  `INSERT INTO transmissions (teacher_id, student_id, hadith_count)
   SELECT t.narrator_id, s.narrator_id, COUNT(DISTINCT c.hadith_id) FROM chain_links s
   JOIN chain_links t ON t.chain_id = s.chain_id AND t.position = s.position + 1
   JOIN chains c ON c.id = s.chain_id
   WHERE s.narrator_id IS NOT NULL AND t.narrator_id IS NOT NULL AND t.narrator_id != s.narrator_id
   GROUP BY t.narrator_id, s.narrator_id`,
];

const rev = (
  db: Session,
  entity: string,
  id: number,
  field: string,
  oldV: unknown,
  newV: unknown,
  actor: string,
  reason: string,
) =>
  db
    .prepare(
      'INSERT INTO revisions (entity, entity_id, field, old_value, new_value, actor_email, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(entity, id, field, oldV == null ? null : String(oldV), newV == null ? null : String(newV), actor, reason);

/** Build the batch that applies a proposal. Reads current values first so revisions record old → new. */
async function applyStatements(
  db: Session,
  kind: string,
  payload: unknown,
  actor: string,
  reason: string,
): Promise<D1PreparedStatement[]> {
  const v = validateProposal({ kind, payload });
  if (!v.ok) throw new Error(v.error);
  const p = v.value;
  if (p.kind === 'set_field') {
    const { entity, id, field, value } = p.payload;
    const table = TABLE[entity];
    const cur = await db.prepare(`SELECT ${field} AS v FROM ${table} WHERE id = ?`).bind(id).first<{ v: unknown }>();
    if (!cur) throw new Error(`${entity} ${id} not found`);
    return [
      db.prepare(`UPDATE ${table} SET ${field} = ? WHERE id = ?`).bind(value as never, id),
      rev(db, entity, id, field, cur.v, value, actor, reason),
    ];
  }
  if (p.kind === 'set_link') {
    const { chainId, position, narratorSlug, linkKind, termAr } = p.payload;
    const cur = await db
      .prepare('SELECT narrator_id, link_kind, term_ar FROM chain_links WHERE chain_id = ? AND position = ?')
      .bind(chainId, position)
      .first<{ narrator_id: number | null; link_kind: string; term_ar: string | null }>();
    if (!cur) throw new Error('link not found');
    const out: D1PreparedStatement[] = [];
    const entityId = chainId * 1000 + position; // revisions key for a link: chain × 1000 + position
    if (narratorSlug !== undefined) {
      let nid: number | null = null;
      if (narratorSlug !== null) {
        const n = await db
          .prepare('SELECT id FROM narrators WHERE slug = ?')
          .bind(narratorSlug)
          .first<{ id: number }>();
        if (!n) throw new Error(`narrator ${narratorSlug} not found`);
        nid = n.id;
      }
      out.push(
        db
          .prepare(
            'UPDATE chain_links SET narrator_id = ?, resolution = ?, confidence = NULL WHERE chain_id = ? AND position = ?',
          )
          .bind(nid, nid == null ? 'unresolved' : 'manual', chainId, position),
        rev(db, 'chain_link', entityId, 'narrator_id', cur.narrator_id, nid, actor, reason),
      );
    }
    if (linkKind !== undefined && linkKind !== cur.link_kind) {
      out.push(
        db
          .prepare('UPDATE chain_links SET link_kind = ? WHERE chain_id = ? AND position = ?')
          .bind(linkKind, chainId, position),
        rev(db, 'chain_link', entityId, 'link_kind', cur.link_kind, linkKind, actor, reason),
      );
      if (position === 1)
        out.push(
          db.prepare('UPDATE chains SET is_suspended = ? WHERE id = ?').bind(linkKind === 'suspended' ? 1 : 0, chainId),
        );
    }
    if (termAr !== undefined && termAr !== cur.term_ar) {
      out.push(
        db
          .prepare('UPDATE chain_links SET term_ar = ? WHERE chain_id = ? AND position = ?')
          .bind(termAr, chainId, position),
        rev(db, 'chain_link', entityId, 'term_ar', cur.term_ar, termAr, actor, reason),
      );
    }
    if (!out.length) throw new Error('nothing to change');
    return [...out, ...REBUILD_TRANSMISSIONS.map((s) => db.prepare(s))];
  }
  if (p.kind === 'merge_narrators') {
    const from = await db
      .prepare('SELECT id, slug FROM narrators WHERE slug = ?')
      .bind(p.payload.from)
      .first<{ id: number; slug: string }>();
    const into = await db
      .prepare('SELECT id FROM narrators WHERE slug = ?')
      .bind(p.payload.into)
      .first<{ id: number }>();
    if (!from || !into) throw new Error('narrator not found');
    const [f, t] = [from.id, into.id];
    return [
      'DELETE FROM transmissions',
      `INSERT OR IGNORE INTO narrator_names SELECT ${t}, form_ar, form_norm, kind FROM narrator_names WHERE narrator_id = ${f}`,
      `DELETE FROM narrator_names WHERE narrator_id = ${f}`,
      `INSERT OR IGNORE INTO narrator_places SELECT ${t}, place_id, relation, citation_id FROM narrator_places WHERE narrator_id = ${f}`,
      `DELETE FROM narrator_places WHERE narrator_id = ${f}`,
      `INSERT OR IGNORE INTO narrator_flags SELECT ${t}, flag, note_ar, citation_id FROM narrator_flags WHERE narrator_id = ${f}`,
      `DELETE FROM narrator_flags WHERE narrator_id = ${f}`,
      `UPDATE gradings SET narrator_id = ${t} WHERE narrator_id = ${f}`,
      `UPDATE gradings SET critic_id = ${t} WHERE critic_id = ${f}`,
      `UPDATE chain_links SET narrator_id = ${t}, resolution = 'manual' WHERE narrator_id = ${f}`,
      `UPDATE collections SET compiler_id = ${t} WHERE compiler_id = ${f}`,
      `UPDATE narrator_redirects SET narrator_id = ${t} WHERE narrator_id = ${f}`,
    ]
      .map((s) => db.prepare(s))
      .concat([
        // The old slug keeps working (SPEC §14).
        db
          .prepare('INSERT OR REPLACE INTO narrator_redirects (old_slug, narrator_id) VALUES (?, ?)')
          .bind(from.slug, t),
        db.prepare('DELETE FROM narrators WHERE id = ?').bind(f),
        rev(db, 'narrator', f, 'merged_into', from.slug, p.payload.into, actor, reason),
        db.prepare(REBUILD_TRANSMISSIONS[1]!),
      ]);
  }
  // add_citation
  const c = p.payload;
  const out: D1PreparedStatement[] = [];
  if (c.newSource) {
    out.push(
      db
        .prepare(
          'INSERT OR IGNORE INTO sources (slug, kind, title_ar, edition, url, license) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(
          c.sourceSlug,
          c.newSource.kind,
          c.newSource.titleAr,
          c.newSource.edition ?? null,
          c.newSource.url ?? null,
          c.newSource.license,
        ),
    );
  } else {
    const s = await db.prepare('SELECT id FROM sources WHERE slug = ?').bind(c.sourceSlug).first();
    if (!s) throw new Error(`source ${c.sourceSlug} not found`);
  }
  const column = c.target === 'dates' ? 'dates_citation_id' : 'summary_grade_citation_id';
  const cur = await db
    .prepare(`SELECT ${column} AS v FROM narrators WHERE id = ?`)
    .bind(c.narratorId)
    .first<{ v: number | null }>();
  if (!cur) throw new Error('narrator not found');
  out.push(
    db
      .prepare('INSERT INTO citations (source_id, locator, url) VALUES ((SELECT id FROM sources WHERE slug = ?), ?, ?)')
      .bind(c.sourceSlug, c.locator, c.url ?? null),
    db
      .prepare(
        `UPDATE narrators SET ${column} = (SELECT MAX(id) FROM citations WHERE source_id = (SELECT id FROM sources WHERE slug = ?) AND locator = ?) WHERE id = ?`,
      )
      .bind(c.sourceSlug, c.locator, c.narratorId),
    rev(db, 'narrator', c.narratorId, column, cur.v, `${c.sourceSlug}: ${c.locator}`, actor, reason),
  );
  return out;
}

export async function decide(
  db: Session,
  staff: Staff,
  id: number,
  approve: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = await db
    .prepare('SELECT id, kind, payload, reason, proposed_by, status, review_item_id FROM proposals WHERE id = ?')
    .bind(id)
    .first<{
      id: number;
      kind: string;
      payload: string;
      reason: string;
      proposed_by: string;
      status: string;
      review_item_id: number | null;
    }>();
  if (!p || p.status !== 'pending') return { ok: false, error: 'not a pending proposal' };
  if (p.proposed_by === staff.email && staff.role !== 'admin')
    return { ok: false, error: 'a proposal is decided by someone other than its author' };
  const close = [
    db
      .prepare(
        "UPDATE proposals SET status = ?, decided_by = ?, decided_at = datetime('now') WHERE id = ? AND status = 'pending'",
      )
      .bind(approve ? 'applied' : 'rejected', staff.email, id),
  ];
  if (!approve) {
    await db.batch(close);
    return { ok: true };
  }
  let stmts: D1PreparedStatement[];
  try {
    stmts = await applyStatements(
      db,
      p.kind,
      JSON.parse(p.payload),
      staff.email,
      `${p.reason} (اقترحه ${p.proposed_by})`,
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (p.review_item_id != null)
    close.push(db.prepare("UPDATE review_items SET status = 'resolved' WHERE id = ?").bind(p.review_item_id));
  await db.batch([...stmts, ...close]); // one batch: all or nothing
  return { ok: true };
}

/** Publishing bumps the data version, so every versioned cache key changes (SPEC §8 step 9). */
export async function publish(db: Session, env: Env, staff: Staff, notes: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replaceAll('-', '.');
  const n = await db
    .prepare('SELECT COUNT(*) AS n FROM data_versions WHERE label LIKE ?')
    .bind(`${today}-%`)
    .first<{ n: number }>();
  const label = `${today}-${(n?.n ?? 0) + 1}`;
  await db
    .prepare(
      "INSERT INTO data_versions (label, published_at, notes) VALUES (?, strftime('%Y-%m-%dT%H:%M:%SZ','now'), ?)",
    )
    .bind(label, `${notes} — ${staff.email}`)
    .run();
  await env.CONFIG.put('data_version', label);
  return label;
}
