/** Read models for the editorial tools. */
export const QUEUE_PAGE = 50;

export interface QueueItem {
  id: number;
  kind: string;
  entity: string | null;
  entityId: number | null;
  detail: Record<string, unknown>;
  status: string;
  createdAt: string;
  pending: number;
}

type Session = D1DatabaseSession;
type Raw = Omit<QueueItem, 'detail'> & { detail: string };
const parse = (r: Raw): QueueItem => ({ ...r, detail: JSON.parse(r.detail) as Record<string, unknown> });

export async function listQueue(
  db: Session,
  q: { kind?: string | undefined; status: string; hadith?: number | undefined; cursor: number },
) {
  const where = ['ri.status = ?'];
  const binds: unknown[] = [q.status];
  if (q.kind) {
    where.push('ri.kind = ?');
    binds.push(q.kind);
  }
  if (q.hadith) {
    where.push("ri.entity = 'hadith' AND ri.entity_id = ?");
    binds.push(q.hadith);
  }
  const [items, kinds] = await db.batch([
    db
      .prepare(
        `SELECT ri.id, ri.kind, ri.entity, ri.entity_id AS entityId, ri.detail, ri.status, ri.created_at AS createdAt,
           (SELECT COUNT(*) FROM proposals p WHERE p.review_item_id = ri.id AND p.status = 'pending') AS pending
         FROM review_items ri WHERE ${where.join(' AND ')} ORDER BY ri.kind, ri.entity_id, ri.id LIMIT ? OFFSET ?`,
      )
      .bind(...binds, QUEUE_PAGE + 1, q.cursor),
    db.prepare('SELECT kind, status, COUNT(*) AS n FROM review_items GROUP BY kind, status ORDER BY kind'),
  ]);
  const rows = ((items?.results ?? []) as Raw[]).map(parse);
  return {
    items: rows.slice(0, QUEUE_PAGE),
    nextCursor: rows.length > QUEUE_PAGE ? q.cursor + QUEUE_PAGE : null,
    kinds: (kinds?.results ?? []) as { kind: string; status: string; n: number }[],
  };
}

export async function reviewItem(db: Session, id: number) {
  const r = await db
    .prepare(
      `SELECT id, kind, entity, entity_id AS entityId, detail, status, created_at AS createdAt,
         (SELECT COUNT(*) FROM proposals p WHERE p.review_item_id = review_items.id AND p.status = 'pending') AS pending
       FROM review_items WHERE id = ?`,
    )
    .bind(id)
    .first<Raw>();
  return r ? parse(r) : null;
}

export async function listProposals(db: Session, status: string) {
  const { results } = await db
    .prepare(
      'SELECT id, review_item_id AS reviewItemId, kind, payload, reason, proposed_by AS proposedBy, status, decided_by AS decidedBy, decided_at AS decidedAt, created_at AS createdAt FROM proposals WHERE status = ? ORDER BY id DESC LIMIT 200',
    )
    .bind(status)
    .all<{ payload: string } & Record<string, unknown>>();
  return results.map((r) => ({ ...r, payload: JSON.parse(r.payload) as unknown }));
}

export async function listReports(db: Session) {
  const { results } = await db
    .prepare(
      "SELECT id, entity, entity_id AS entityId, message, contact, status, created_at AS createdAt FROM reports ORDER BY status = 'open' DESC, id DESC LIMIT 200",
    )
    .all();
  return results;
}

/** Applied changes since the last publish, for the publish screen's diff summary. */
export async function changesSincePublish(db: Session) {
  const last = await db
    .prepare('SELECT label, published_at AS at FROM data_versions ORDER BY id DESC LIMIT 1')
    .first<{ label: string; at: string }>();
  const { results } = await db
    .prepare(
      "SELECT entity, field, COUNT(*) AS n FROM revisions WHERE created_at > COALESCE(replace(replace(?, 'T', ' '), 'Z', ''), '') GROUP BY entity, field ORDER BY n DESC",
    )
    .bind(last?.at ?? null)
    .all<{ entity: string; field: string; n: number }>();
  return { last, changes: results };
}
