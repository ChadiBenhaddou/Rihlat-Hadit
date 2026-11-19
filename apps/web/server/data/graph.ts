import { assembleGraph, type LinkRow } from '@isnad/graph';
import type { IsnadGraph } from '@isnad/shared';
import type { Db } from '../db';
import { CITATION_COLUMNS, type CitationRow, splitCitations } from './common';

/** Columns for LinkRow; pair with `FROM chains c JOIN chain_links l … LEFT JOIN narrators n …`. */
export const LINK_COLUMNS = `c.id AS chainId, h.ref_number AS hadithNumber, c.route_no AS routeNo, c.terminus,
  c.is_suspended AS isSuspended, c.citation_id AS chainCitationId, l.position, l.narrator_id AS narratorId,
  l.mention_ar AS mentionAr, l.mention_start AS mentionStart, l.mention_end AS mentionEnd, l.term_ar AS termAr, l.link_kind AS linkKind, n.slug, n.display_name_ar AS displayNameAr,
  n.honorific_ar AS honorificAr, n.role, n.tabaqa, n.birth_ah AS birthAh, n.death_ah AS deathAh,
  n.death_ah_max AS deathAhMax, n.dates_citation_id AS datesCitationId, n.summary_grade_ar AS summaryGradeAr,
  n.summary_grade_citation_id AS summaryGradeCitationId, n.review_status AS reviewStatus`;

const LINKS_FROM = `FROM chains c JOIN hadiths h ON h.id = c.hadith_id JOIN chain_links l ON l.chain_id = c.id
  LEFT JOIN narrators n ON n.id = l.narrator_id`;

const PLACE_COLUMNS = 'np.narrator_id AS narratorId, p.name_ar AS nameAr, np.citation_id AS citationId';

/** Statements for one hadith's graph: links, citations, then places. `hadithSel` selects hadiths.id. */
export function hadithGraphStatements(db: Db, hadithSel: string, binds: unknown[]) {
  return [
    db
      .prepare(
        `SELECT ${LINK_COLUMNS} ${LINKS_FROM} WHERE c.hadith_id = (${hadithSel}) ORDER BY c.route_no, l.position`,
      )
      .bind(...binds),
    db
      .prepare(
        `SELECT ${CITATION_COLUMNS} FROM citations ci JOIN sources s ON s.id = ci.source_id WHERE ci.id IN (
           SELECT citation_id FROM chains WHERE hadith_id = (${hadithSel})
           UNION SELECT n.dates_citation_id FROM chains c JOIN chain_links l ON l.chain_id = c.id
             JOIN narrators n ON n.id = l.narrator_id WHERE c.hadith_id = (${hadithSel})
           UNION SELECT citation_id FROM hadiths WHERE id = (${hadithSel})
           UNION SELECT np.citation_id FROM narrator_places np WHERE np.narrator_id IN (
             SELECT l.narrator_id FROM chains c JOIN chain_links l ON l.chain_id = c.id WHERE c.hadith_id = (${hadithSel})))`,
      )
      .bind(...binds, ...binds, ...binds, ...binds),
    db
      .prepare(
        `SELECT ${PLACE_COLUMNS} FROM narrator_places np JOIN places p ON p.id = np.place_id WHERE np.narrator_id IN (
           SELECT l.narrator_id FROM chains c JOIN chain_links l ON l.chain_id = c.id WHERE c.hadith_id = (${hadithSel}))`,
      )
      .bind(...binds),
  ];
}

/** Statements for a route group's merged graph (all routes, SPEC §12 ج). */
export function groupGraphStatements(db: Db, groupId: number) {
  return [
    db
      .prepare(
        `SELECT ${LINK_COLUMNS} ${LINKS_FROM} WHERE h.group_id = ? ORDER BY h.ref_number, c.route_no, l.position`,
      )
      .bind(groupId),
    db
      .prepare(
        `SELECT ${CITATION_COLUMNS} FROM citations ci JOIN sources s ON s.id = ci.source_id WHERE ci.id IN (
           SELECT c.citation_id FROM chains c JOIN hadiths h ON h.id = c.hadith_id WHERE h.group_id = ?
           UNION SELECT n.dates_citation_id FROM chains c JOIN hadiths h ON h.id = c.hadith_id
             JOIN chain_links l ON l.chain_id = c.id JOIN narrators n ON n.id = l.narrator_id WHERE h.group_id = ?
           UNION SELECT np.citation_id FROM narrator_places np WHERE np.narrator_id IN (
             SELECT l.narrator_id FROM chains c JOIN hadiths h ON h.id = c.hadith_id
             JOIN chain_links l ON l.chain_id = c.id WHERE h.group_id = ?))`,
      )
      .bind(groupId, groupId, groupId),
    db
      .prepare(
        `SELECT ${PLACE_COLUMNS} FROM narrator_places np JOIN places p ON p.id = np.place_id WHERE np.narrator_id IN (
           SELECT l.narrator_id FROM chains c JOIN hadiths h ON h.id = c.hadith_id
           JOIN chain_links l ON l.chain_id = c.id WHERE h.group_id = ?)`,
      )
      .bind(groupId),
  ];
}

export interface PlaceRow {
  narratorId: number;
  nameAr: string;
  citationId: number | null;
}

export function toGraph(
  links: LinkRow[],
  citationRows: CitationRow[],
  scope: IsnadGraph['scope'],
  dataVersion: string,
  placeRows: PlaceRow[] = [],
): { graph: IsnadGraph; sources: ReturnType<typeof splitCitations>['sources'] } {
  const { citations, sources } = splitCitations(citationRows);
  const rows = links.map((r) => ({ ...r, isSuspended: Boolean(r.isSuspended) }));
  const places = new Map<number, { nameAr: string; citationId: number | null }[]>();
  for (const p of placeRows)
    places.set(p.narratorId, [...(places.get(p.narratorId) ?? []), { nameAr: p.nameAr, citationId: p.citationId }]);
  return { graph: assembleGraph(rows, scope, dataVersion, citations, places), sources };
}

export async function getGroupGraph(db: Db, groupId: number, dataVersion: string) {
  const [links, cites, places] = await db.batch(groupGraphStatements(db, groupId));
  const linkRows = (links?.results ?? []) as LinkRow[];
  if (linkRows.length === 0) return null;
  return toGraph(
    linkRows,
    (cites?.results ?? []) as CitationRow[],
    { kind: 'group', groupId },
    dataVersion,
    (places?.results ?? []) as PlaceRow[],
  );
}
