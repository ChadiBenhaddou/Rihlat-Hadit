/**
 * Narrator network (SPEC §12 د) from the derived `transmissions` table. Depth is
 * at most 2 and a view at most 500 nodes, so a request never loads the whole network.
 */
import type { NetworkResponse, SharedResponse } from '@isnad/shared';
import type { Db } from '../db';

export const MAX_NODES = 500;
const ID = 'SELECT id FROM narrators WHERE slug = ?';

export async function getNetwork(
  db: Db,
  slug: string,
  depth: 1 | 2,
  limit: number,
  dataVersion: string,
): Promise<NetworkResponse | null> {
  const cap = Math.min(MAX_NODES, Math.max(10, limit));
  // First ring: the strongest teacher and student links of the centre.
  const ring1 = `SELECT other FROM (
      SELECT teacher_id AS other, hadith_count AS c FROM transmissions WHERE student_id = (${ID})
      UNION ALL SELECT student_id, hadith_count FROM transmissions WHERE teacher_id = (${ID})
    ) GROUP BY other ORDER BY MAX(c) DESC LIMIT ${cap - 1}`;
  const members =
    depth === 1
      ? `SELECT (${ID}) AS id UNION SELECT other FROM (${ring1})`
      : `SELECT (${ID}) AS id UNION SELECT other FROM (${ring1}) UNION SELECT other FROM (
           SELECT CASE WHEN t.teacher_id IN (SELECT other FROM (${ring1})) THEN t.student_id ELSE t.teacher_id END AS other, t.hadith_count AS c
           FROM transmissions t
           WHERE t.teacher_id IN (SELECT other FROM (${ring1})) OR t.student_id IN (SELECT other FROM (${ring1}))
           ORDER BY c DESC LIMIT ${cap})`;
  // Every placeholder in `members` is the centre's slug.
  const binds = Array<string>(members.split('?').length - 1).fill(slug);
  const [center, nodes, edges] = await db.batch([
    db.prepare('SELECT slug FROM narrators WHERE slug = ?').bind(slug),
    db
      .prepare(
        `SELECT n.slug, n.display_name_ar AS nameAr, n.tabaqa, n.death_ah AS deathAh, n.role FROM narrators n WHERE n.id IN (${members}) LIMIT ${cap}`,
      )
      .bind(...binds),
    db
      .prepare(
        `SELECT a.slug AS teacher, b.slug AS student, t.hadith_count AS count FROM transmissions t
         JOIN narrators a ON a.id = t.teacher_id JOIN narrators b ON b.id = t.student_id
         WHERE t.teacher_id IN (${members}) AND t.student_id IN (${members})`,
      )
      .bind(...binds, ...binds),
  ]);
  if (!center?.results?.length) return null;
  const nodeRows = (nodes?.results ?? []) as NetworkResponse['nodes'];
  return {
    dataVersion,
    center: slug,
    depth,
    truncated: nodeRows.length >= cap,
    nodes: nodeRows,
    edges: (edges?.results ?? []) as NetworkResponse['edges'],
  };
}

export const SHARED_PAGE = 50;

export async function getShared(
  db: Db,
  a: string,
  b: string,
  offset: number,
  dataVersion: string,
): Promise<SharedResponse> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT h.ref_number AS n FROM chain_links x
       JOIN chain_links y ON y.chain_id = x.chain_id AND (y.position = x.position + 1 OR y.position = x.position - 1)
       JOIN chains c ON c.id = x.chain_id JOIN hadiths h ON h.id = c.hadith_id
       WHERE x.narrator_id = (${ID}) AND y.narrator_id = (${ID})
       ORDER BY h.ref_number LIMIT ? OFFSET ?`,
    )
    .bind(a, b, SHARED_PAGE + 1, offset)
    .all<{ n: number }>();
  const numbers = results.map((r) => r.n);
  return {
    dataVersion,
    a,
    b,
    numbers: numbers.slice(0, SHARED_PAGE),
    nextCursor: numbers.length > SHARED_PAGE ? String(offset + SHARED_PAGE) : null,
  };
}
