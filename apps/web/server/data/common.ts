import type { Citation, SourceInfo } from '@isnad/shared';

export interface CitationRow {
  id: number;
  locator: string | null;
  url: string | null;
  slug: string;
  kind: SourceInfo['kind'];
  title_ar: string;
  title_en: string | null;
  edition: string | null;
  source_url: string | null;
  license: string;
  attribution: string | null;
}

/** SELECT list for citations joined to their source; pair with `FROM citations ci JOIN sources s ON s.id = ci.source_id`. */
export const CITATION_COLUMNS =
  'ci.id, ci.locator, ci.url, s.slug, s.kind, s.title_ar, s.title_en, s.edition, s.url AS source_url, s.license, s.attribution';

export function splitCitations(rows: CitationRow[]): { citations: Citation[]; sources: SourceInfo[] } {
  const sources = new Map<string, SourceInfo>();
  const citations = rows.map((r) => {
    if (!sources.has(r.slug)) {
      sources.set(r.slug, {
        slug: r.slug,
        kind: r.kind,
        titleAr: r.title_ar,
        titleEn: r.title_en,
        edition: r.edition,
        url: r.source_url,
        license: r.license,
        attribution: r.attribution,
      });
    }
    const c: Citation = { id: r.id, sourceSlug: r.slug };
    if (r.locator) c.locator = r.locator;
    if (r.url) c.url = r.url;
    return c;
  });
  return { citations, sources: [...sources.values()] };
}

export const ALL_SOURCES_SQL =
  'SELECT slug, kind, title_ar AS titleAr, title_en AS titleEn, edition, url, license, attribution FROM sources ORDER BY id';
