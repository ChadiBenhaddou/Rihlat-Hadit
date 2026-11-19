import type { NarratorLink, NarratorProfile, ReviewStatus } from '@isnad/shared';
import type { Db } from '../db';
import { CITATION_COLUMNS, type CitationRow, splitCitations } from './common';

const ID = 'SELECT id FROM narrators WHERE slug = ?';
const HADITH_LIMIT = 2000;

interface NarratorRow {
  id: number;
  slug: string;
  display_name_ar: string;
  full_name_ar: string | null;
  honorific_ar: string | null;
  role: NarratorProfile['role'];
  tabaqa: number | null;
  birth_ah: number | null;
  death_ah: number | null;
  death_ah_max: number | null;
  dates_citation_id: number | null;
  summary_grade_ar: string | null;
  summary_grade_citation_id: number | null;
  review_status: ReviewStatus;
}

/** A narrator's profile in one D1 batch. Every field carries its citation. */
export async function getNarrator(db: Db, slug: string, dataVersion: string): Promise<NarratorProfile | null> {
  const s = (sql: string, n = 1) => db.prepare(sql).bind(...Array<string>(n).fill(slug));
  const [main, names, places, flags, gradings, teachers, students, hadiths, cites] = await db.batch([
    s('SELECT * FROM narrators WHERE slug = ?'),
    s(
      `SELECT form_ar AS formAr, kind FROM narrator_names WHERE narrator_id = (${ID}) ORDER BY kind = 'full' DESC, length(form_ar) DESC`,
    ),
    s(`SELECT p.name_ar AS nameAr, np.relation, np.citation_id AS citationId FROM narrator_places np
       JOIN places p ON p.id = np.place_id WHERE np.narrator_id = (${ID}) ORDER BY np.relation DESC, p.name_ar`),
    s(`SELECT flag, citation_id AS citationId FROM narrator_flags WHERE narrator_id = (${ID})`),
    s(`SELECT COALESCE(c.display_name_ar, g.critic_name_ar) AS criticAr, g.statement_ar AS statementAr, g.citation_id AS citationId
       FROM gradings g LEFT JOIN narrators c ON c.id = g.critic_id WHERE g.narrator_id = (${ID}) ORDER BY g.id`),
    s(`SELECT n.slug, n.display_name_ar AS nameAr, n.death_ah AS deathAh, t.hadith_count AS count FROM transmissions t
       JOIN narrators n ON n.id = t.teacher_id WHERE t.student_id = (${ID}) ORDER BY t.hadith_count DESC, n.id LIMIT 100`),
    s(`SELECT n.slug, n.display_name_ar AS nameAr, n.death_ah AS deathAh, t.hadith_count AS count FROM transmissions t
       JOIN narrators n ON n.id = t.student_id WHERE t.teacher_id = (${ID}) ORDER BY t.hadith_count DESC, n.id LIMIT 100`),
    s(`SELECT DISTINCT h.ref_number AS n FROM chain_links l JOIN chains c ON c.id = l.chain_id JOIN hadiths h ON h.id = c.hadith_id
       WHERE l.narrator_id = (${ID}) ORDER BY h.ref_number LIMIT ${HADITH_LIMIT + 1}`),
    s(
      `SELECT ${CITATION_COLUMNS} FROM citations ci JOIN sources s ON s.id = ci.source_id WHERE ci.id IN (
         SELECT dates_citation_id FROM narrators WHERE slug = ?
         UNION SELECT summary_grade_citation_id FROM narrators WHERE slug = ?
         UNION SELECT citation_id FROM narrator_places WHERE narrator_id = (${ID})
         UNION SELECT citation_id FROM narrator_flags WHERE narrator_id = (${ID})
         UNION SELECT citation_id FROM gradings WHERE narrator_id = (${ID}))`,
      5,
    ),
  ]);
  const n = (main?.results?.[0] ?? null) as NarratorRow | null;
  if (!n) return null;
  const numbers = ((hadiths?.results ?? []) as { n: number }[]).map((r) => r.n);
  const { citations, sources } = splitCitations((cites?.results ?? []) as CitationRow[]);
  return {
    dataVersion,
    id: n.id,
    slug: n.slug,
    displayNameAr: n.display_name_ar,
    fullNameAr: n.full_name_ar,
    honorificAr: n.honorific_ar,
    role: n.role,
    tabaqa: n.tabaqa,
    birthAh: n.birth_ah,
    deathAh: n.death_ah,
    deathAhMax: n.death_ah_max,
    datesCitationId: n.dates_citation_id,
    // Decision 3: an unattributed summary grade is stored but never shown.
    summaryGrade:
      n.summary_grade_ar && n.summary_grade_citation_id != null
        ? { textAr: n.summary_grade_ar, citationId: n.summary_grade_citation_id }
        : null,
    names: (names?.results ?? []) as NarratorProfile['names'],
    places: (places?.results ?? []) as NarratorProfile['places'],
    flags: (flags?.results ?? []) as NarratorProfile['flags'],
    gradings: (gradings?.results ?? []) as NarratorProfile['gradings'],
    teachers: (teachers?.results ?? []) as NarratorLink[],
    students: (students?.results ?? []) as NarratorLink[],
    hadithCount: numbers.length > HADITH_LIMIT ? HADITH_LIMIT : numbers.length,
    hadithNumbers: numbers.slice(0, HADITH_LIMIT),
    reviewStatus: n.review_status,
    citations,
    sources,
  };
}
