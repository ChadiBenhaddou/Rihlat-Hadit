import type { LinkRow } from '@isnad/graph';
import type { HadithResponse, ReviewStatus } from '@isnad/shared';
import type { Db } from '../db';
import type { CitationRow } from './common';
import { hadithGraphStatements, toGraph } from './graph';

const HADITH_SEL =
  'SELECT h.id FROM hadiths h JOIN collections c ON c.id = h.collection_id WHERE c.slug = ? AND h.ref_number = ?';
const TASHKEEL = /[\u064B-\u0652]/;

interface HadithRow {
  id: number;
  ref_number: number;
  text_ar: string;
  isnad_ar: string | null;
  matn_ar: string | null;
  group_id: number | null;
  citation_id: number;
  review_status: ReviewStatus;
  chapter_id: number | null;
  chapter_no: number | null;
  chapter_title: string | null;
  book_no: number | null;
  book_title: string | null;
  prev: number | null;
  next: number | null;
}

/** One hadith page: entry, numbers and graph in a single D1 batch (SPEC §15: ≤ 3 queries per page). */
export async function getHadith(
  db: Db,
  collection: string,
  number: number,
  dataVersion: string,
): Promise<HadithResponse | null> {
  const binds = [collection, number];
  const [main, numbers, links, cites] = await db.batch([
    db
      .prepare(
        `SELECT h.id, h.ref_number, h.text_ar, h.isnad_ar, h.matn_ar, h.group_id, h.citation_id, h.review_status,
           ch.id AS chapter_id, ch.number AS chapter_no, ch.title_ar AS chapter_title, b.number AS book_no, b.title_ar AS book_title,
           (SELECT MAX(ref_number) FROM hadiths WHERE collection_id = h.collection_id AND ref_number < h.ref_number) AS prev,
           (SELECT MIN(ref_number) FROM hadiths WHERE collection_id = h.collection_id AND ref_number > h.ref_number) AS next
         FROM hadiths h JOIN collections c ON c.id = h.collection_id
         LEFT JOIN chapters ch ON ch.id = h.chapter_id LEFT JOIN books b ON b.id = ch.book_id
         WHERE c.slug = ? AND h.ref_number = ?`,
      )
      .bind(...binds),
    db
      .prepare(`SELECT scheme, value FROM hadith_numbers WHERE hadith_id = (${HADITH_SEL}) ORDER BY scheme`)
      .bind(...binds),
    ...hadithGraphStatements(db, HADITH_SEL, binds),
  ]);
  const h = (main?.results?.[0] ?? null) as HadithRow | null;
  if (!h) return null;
  const { graph, sources } = toGraph(
    (links?.results ?? []) as LinkRow[],
    (cites?.results ?? []) as CitationRow[],
    { kind: 'hadith', collection, number },
    dataVersion,
  );
  return {
    dataVersion,
    collection,
    number: h.ref_number,
    textAr: h.text_ar,
    isnadAr: h.isnad_ar,
    matnAr: h.matn_ar,
    vocalized: TASHKEEL.test(h.text_ar),
    book: h.book_no != null && h.book_title ? { number: h.book_no, titleAr: h.book_title } : null,
    chapter:
      h.chapter_id != null && h.chapter_title
        ? { id: h.chapter_id, number: h.chapter_no, titleAr: h.chapter_title }
        : null,
    numbers: (numbers?.results ?? []) as { scheme: string; value: string }[],
    prev: h.prev,
    next: h.next,
    groupId: h.group_id,
    citationId: h.citation_id,
    reviewStatus: h.review_status,
    graph,
    sources,
  };
}
