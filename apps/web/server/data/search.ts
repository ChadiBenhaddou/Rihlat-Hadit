/**
 * Text search (SPEC §9): normalize and stem the query with the shared code,
 * match each token on surface or stem with prefix matching, AND the tokens,
 * and treat quoted text as a phrase. bm25 ranks surface above stem matches.
 */
import { analyzeArabic, normalizeArabic, stemArabic, type SearchResponse } from '@isnad/shared';
import type { Db } from '../db';

export const PAGE_SIZE = 20;

/** Build an FTS5 MATCH expression, or null when nothing searchable remains. */
export function ftsExpression(query: string): { expr: string; terms: string[] } | null {
  const parts: string[] = [];
  const terms = new Set<string>();
  // Quoted phrases first, then the remaining words.
  const rest = query.replace(/["«]([^"»]+)["»]/g, (_, phrase: string) => {
    const words = normalizeArabic(phrase).split(' ').filter(Boolean);
    if (words.length) {
      parts.push(`{surface} : "${words.join(' ')}"`);
      words.forEach((w) => terms.add(w));
    }
    return ' ';
  });
  const { surface, stem } = analyzeArabic(rest);
  surface.forEach((tok, i) => {
    if ([...tok].length < 2) return; // single letters (و، ب) are not searchable on their own
    const st = stem[i]!;
    terms.add(tok);
    terms.add(st);
    parts.push(st === tok ? `{surface stem} : "${tok}" *` : `({surface} : "${tok}" * OR {stem} : "${st}" *)`);
  });
  return parts.length ? { expr: parts.join(' AND '), terms: [...terms] } : null;
}

export function isNumberQuery(q: string): number | null {
  const n = normalizeArabic(q);
  return /^\d{1,5}$/.test(n) ? Number(n) : null;
}

export async function searchHadith(
  db: Db,
  search: Db,
  q: string,
  offset: number,
  dataVersion: string,
): Promise<SearchResponse> {
  const empty = {
    dataVersion,
    query: q,
    type: 'hadith' as const,
    terms: [],
    numberMatch: null,
    results: [],
    nextCursor: null,
  };
  const asNumber = isNumberQuery(q);
  let numberMatch: number | null = null;
  if (asNumber != null) {
    const row = await db
      .prepare(
        "SELECT ref_number FROM hadiths h JOIN collections c ON c.id = h.collection_id WHERE c.slug = 'bukhari' AND ref_number = ?",
      )
      .bind(asNumber)
      .first<{ ref_number: number }>();
    numberMatch = row?.ref_number ?? null;
  }
  const fts = ftsExpression(q);
  if (!fts) return { ...empty, numberMatch, results: numberMatch ? await hitsFor(db, [numberMatch]) : [] };
  const { results } = await search
    .prepare(
      'SELECT hadith_id AS id FROM matn_fts WHERE matn_fts MATCH ? ORDER BY bm25(matn_fts, 0, 0, 2.0, 1.0) LIMIT ? OFFSET ?',
    )
    .bind(fts.expr, PAGE_SIZE + 1, offset)
    .all<{ id: number }>();
  const ids = results.map((r) => r.id);
  const page = ids.slice(0, PAGE_SIZE);
  if (numberMatch != null && offset === 0 && !page.includes(numberMatch)) page.unshift(numberMatch);
  return {
    ...empty,
    terms: fts.terms,
    numberMatch,
    results: await hitsFor(db, page),
    nextCursor: ids.length > PAGE_SIZE ? String(offset + PAGE_SIZE) : null,
  };
}

async function hitsFor(db: Db, ids: number[]): Promise<SearchResponse['results']> {
  if (ids.length === 0) return [];
  const { results } = await db
    .prepare(
      `SELECT h.ref_number AS number, h.text_ar AS textAr, b.title_ar AS bookTitleAr, ch.title_ar AS chapterTitleAr
       FROM hadiths h LEFT JOIN chapters ch ON ch.id = h.chapter_id LEFT JOIN books b ON b.id = ch.book_id
       WHERE h.id IN (${ids.map(() => '?').join(',')})`,
    )
    .bind(...ids)
    .all<{ number: number; textAr: string; bookTitleAr: string | null; chapterTitleAr: string | null }>();
  const byId = new Map(results.map((r) => [r.number, r]));
  return ids.flatMap((id) => {
    const r = byId.get(id);
    return r ? [{ kind: 'hadith' as const, collection: 'bukhari', ...r }] : [];
  });
}

export async function searchNarrators(
  db: Db,
  search: Db,
  q: string,
  offset: number,
  dataVersion: string,
): Promise<SearchResponse> {
  const base = { dataVersion, query: q, type: 'narrator' as const, numberMatch: null };
  const fts = ftsExpression(q);
  if (!fts) return { ...base, terms: [], results: [], nextCursor: null };
  const { results } = await search
    .prepare(
      'SELECT narrator_id AS id FROM narrator_fts WHERE narrator_fts MATCH ? ORDER BY bm25(narrator_fts, 0, 2.0, 1.0) LIMIT ? OFFSET ?',
    )
    .bind(fts.expr, PAGE_SIZE + 1, offset)
    .all<{ id: number }>();
  const ids = results.map((r) => r.id).slice(0, PAGE_SIZE);
  let hits: SearchResponse['results'] = [];
  if (ids.length) {
    // Show death year, city and tabaqa in every result: many narrators share names (SPEC §9).
    const rows = await db
      .prepare(
        `SELECT n.id, n.slug, n.display_name_ar AS nameAr, n.death_ah AS deathAh, n.tabaqa,
           (SELECT p.name_ar FROM narrator_places np JOIN places p ON p.id = np.place_id
              WHERE np.narrator_id = n.id AND np.relation = 'lived' ORDER BY p.id LIMIT 1) AS placeAr,
           (SELECT COUNT(DISTINCT c.hadith_id) FROM chain_links l JOIN chains c ON c.id = l.chain_id WHERE l.narrator_id = n.id) AS hadithCount
         FROM narrators n WHERE n.id IN (${ids.map(() => '?').join(',')})`,
      )
      .bind(...ids)
      .all<{
        id: number;
        slug: string;
        nameAr: string;
        deathAh: number | null;
        tabaqa: number | null;
        placeAr: string | null;
        hadithCount: number;
      }>();
    const byId = new Map(rows.results.map((r) => [r.id, r]));
    hits = ids.flatMap((id) => {
      const r = byId.get(id);
      if (!r) return [];
      const { id: _id, ...rest } = r;
      return [{ kind: 'narrator' as const, ...rest }];
    });
    // Many narrators share a name; among this page's matches, the one who narrates most comes first.
    hits.sort((a, b) => (b.kind === 'narrator' && a.kind === 'narrator' ? b.hadithCount - a.hadithCount : 0));
  }
  return {
    ...base,
    terms: fts.terms,
    results: hits,
    nextCursor: results.length > PAGE_SIZE ? String(offset + PAGE_SIZE) : null,
  };
}

export { normalizeArabic, stemArabic };
