/**
 * TEST FIXTURE — placeholder rows exercising the API, never content. Names
 * are «راوٍ-أ» etc. Two routes of entry 1 converge on narrator 13.
 */
import { env } from 'cloudflare:test';

export const ISNAD = 'حدثنا راوٍ-أ قال حدثنا راوٍ-ب عن راوٍ-ج عن صاحب-د قال سمعت رسول الله \uFDFA يقول ';
export const MATN = 'إنما الأعمال بالنيات';
const TEXT = ISNAD + MATN;
const at = (s: string) => TEXT.indexOf(s);

export async function seed(): Promise<void> {
  const db = env.DB;
  const stmts = [
    `INSERT INTO sources (id, slug, kind, title_ar, license, attribution) VALUES (1, 'fixture-ds', 'dataset', 'مصدر اختبار', 'CC-BY-4.0', 'fixture')`,
    `INSERT INTO citations (id, source_id, locator) VALUES (1, 1, 'h1'), (2, 1, 's1'), (3, 1, 's2'), (4, 1, 'r11'), (5, 1, 'g1')`,
    `INSERT INTO narrators (id, slug, display_name_ar, role, review_status) VALUES (10, 'r10', 'المصنف-اختبار', 'compiler', 'auto')`,
    `INSERT INTO narrators (id, slug, display_name_ar, role, tabaqa, death_ah, dates_citation_id, summary_grade_ar, review_status)
       VALUES (11, 'r11', 'راوٍ-أ', 'narrator', 10, 219, 4, 'وصف غير منسوب', 'auto')`,
    `INSERT INTO narrators (id, slug, display_name_ar, role, review_status) VALUES (12, 'r12', 'راوٍ-ب', 'narrator', 'auto'),
       (13, 'r13', 'راوٍ-ج', 'narrator', 'auto'), (14, 'r14', 'صاحب-د', 'companion', 'auto'), (15, 'r15', 'راوٍ-ه', 'narrator', 'auto')`,
    `INSERT INTO narrators (id, slug, display_name_ar, role, honorific_ar, review_status) VALUES (1000000, 'al-nabi', 'رسول الله', 'prophet', '\uFDFA', 'auto')`,
    `INSERT INTO narrator_names VALUES (11, 'راوٍ-أ', 'راو-ا', 'short')`,
    `INSERT INTO gradings (narrator_id, critic_name_ar, statement_ar, citation_id) VALUES (11, 'ناقد-اختبار', 'قول-اختبار', 5)`,
    `INSERT INTO collections VALUES (1, 'bukhari', 'صحيح البخاري', 'Sahih al-Bukhari', 10)`,
    `INSERT INTO books (id, collection_id, number, title_ar) VALUES (1, 1, 1, 'كتاب-اختبار')`,
    `INSERT INTO chapters (id, book_id, number, title_ar) VALUES (1, 1, 1, 'باب-اختبار')`,
    `INSERT INTO hadith_groups (id, method) VALUES (7, 'dataset')`,
    `INSERT INTO hadiths (id, collection_id, chapter_id, ref_number, text_ar, isnad_ar, matn_ar, group_id, citation_id)
       VALUES (1, 1, 1, 1, '${TEXT}', '${ISNAD}', '${MATN}', 7, 1), (2, 1, 1, 2, 'نص ثان بلا تشكيل', NULL, NULL, NULL, 1)`,
    `INSERT INTO hadith_numbers VALUES (1, 'in-book', '1:1')`,
    `INSERT INTO chains VALUES (1, 1, 1, 'prophet', 0, 2, 'auto'), (2, 1, 2, 'prophet', 1, 3, 'auto')`,
    `INSERT INTO chain_links VALUES
       (1, 0, 10, '', NULL, NULL, NULL, 'connected', 'dataset', NULL),
       (1, 1, 11, 'راوٍ-أ', ${at('راوٍ-أ')}, ${at('راوٍ-أ') + 6}, 'حدثنا', 'connected', 'dataset', NULL),
       (1, 2, 12, 'راوٍ-ب', ${at('راوٍ-ب')}, ${at('راوٍ-ب') + 6}, 'حدثنا', 'connected', 'dataset', NULL),
       (1, 3, 13, 'راوٍ-ج', ${at('راوٍ-ج')}, ${at('راوٍ-ج') + 6}, 'عن', 'connected', 'dataset', NULL),
       (1, 4, 14, 'صاحب-د', ${at('صاحب-د')}, ${at('صاحب-د') + 6}, 'عن', 'connected', 'dataset', NULL),
       (1, 5, 1000000, 'رسول الله', ${at('رسول الله')}, ${at('رسول الله') + 9}, 'سمعت', 'connected', 'auto', NULL),
       (2, 0, 10, '', NULL, NULL, NULL, 'connected', 'dataset', NULL),
       (2, 1, 15, 'راوٍ-ه', NULL, NULL, 'وقال', 'suspended', 'dataset', NULL),
       (2, 2, 13, 'راوٍ-ج', ${at('راوٍ-ج')}, ${at('راوٍ-ج') + 6}, 'عن', 'connected', 'dataset', NULL),
       (2, 3, 14, 'صاحب-د', ${at('صاحب-د')}, ${at('صاحب-د') + 6}, 'عن', 'connected', 'dataset', NULL),
       (2, 4, 1000000, 'رسول الله', ${at('رسول الله')}, ${at('رسول الله') + 9}, 'سمعت', 'connected', 'auto', NULL)`,
    `INSERT INTO transmissions VALUES (11, 10, 1), (12, 11, 1), (13, 12, 1), (13, 15, 1), (14, 13, 1), (15, 10, 1)`,
    `INSERT INTO data_versions (label, published_at) VALUES ('fixture-v1', '2026-01-01T00:00:00Z')`,
  ];
  await db.batch(stmts.map((s) => db.prepare(s)));
  await env.SEARCH_DB.batch([
    env.SEARCH_DB.prepare(`INSERT INTO matn_fts VALUES (1, 'bukhari', 'انما الاعمال بالنيات', 'انما اعمال نيات')`),
    env.SEARCH_DB.prepare(`INSERT INTO matn_fts VALUES (2, 'bukhari', 'نص ثان بلا تشكيل', 'نص ثان بلا تشكيل')`),
    env.SEARCH_DB.prepare(`INSERT INTO narrator_fts VALUES (11, 'راو-ا', 'راو-ا')`),
  ]);
}
