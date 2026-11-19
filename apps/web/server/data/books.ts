import type { BookDetail, BooksResponse, SourceInfo } from '@isnad/shared';
import type { Db } from '../db';
import { ALL_SOURCES_SQL } from './common';

const BOOK_COLUMNS = `b.number, b.title_ar AS titleAr,
  (SELECT COUNT(*) FROM chapters WHERE book_id = b.id) AS chapterCount,
  (SELECT COUNT(*) FROM hadiths h JOIN chapters ch ON ch.id = h.chapter_id WHERE ch.book_id = b.id) AS hadithCount,
  (SELECT MIN(h.ref_number) FROM hadiths h JOIN chapters ch ON ch.id = h.chapter_id WHERE ch.book_id = b.id) AS firstNumber,
  (SELECT MAX(h.ref_number) FROM hadiths h JOIN chapters ch ON ch.id = h.chapter_id WHERE ch.book_id = b.id) AS lastNumber`;

export async function listBooks(db: Db, collection: string, dataVersion: string): Promise<BooksResponse | null> {
  const [col, books, sources] = await db.batch([
    db.prepare('SELECT slug, name_ar AS nameAr, name_en AS nameEn FROM collections WHERE slug = ?').bind(collection),
    db
      .prepare(
        `SELECT ${BOOK_COLUMNS} FROM books b JOIN collections c ON c.id = b.collection_id WHERE c.slug = ? ORDER BY b.number`,
      )
      .bind(collection),
    db.prepare(ALL_SOURCES_SQL),
  ]);
  const c = col?.results?.[0] as BooksResponse['collection'] | undefined;
  if (!c) return null;
  return {
    dataVersion,
    collection: c,
    books: (books?.results ?? []) as BooksResponse['books'],
    sources: (sources?.results ?? []) as SourceInfo[],
  };
}

const OPENING = `substr(COALESCE(h.matn_ar, h.text_ar), 1, 160) AS openingAr,
  EXISTS (SELECT 1 FROM chains WHERE hadith_id = h.id) AS hasChain`;

export async function getBook(
  db: Db,
  collection: string,
  number: number,
  dataVersion: string,
): Promise<BookDetail | null> {
  const [book, rows] = await db.batch([
    db
      .prepare(
        `SELECT ${BOOK_COLUMNS} FROM books b JOIN collections c ON c.id = b.collection_id WHERE c.slug = ? AND b.number = ?`,
      )
      .bind(collection, number),
    db
      .prepare(
        `SELECT ch.id AS chapterId, ch.number AS chapterNo, ch.title_ar AS chapterTitle, h.ref_number AS number, ${OPENING}
         FROM chapters ch JOIN books b ON b.id = ch.book_id JOIN collections c ON c.id = b.collection_id
         LEFT JOIN hadiths h ON h.chapter_id = ch.id
         WHERE c.slug = ? AND b.number = ? ORDER BY ch.number, h.ref_number`,
      )
      .bind(collection, number),
  ]);
  const b = book?.results?.[0] as BookDetail['book'] | undefined;
  if (!b) return null;
  const chapters = new Map<number, BookDetail['chapters'][number]>();
  for (const r of (rows?.results ?? []) as {
    chapterId: number;
    chapterNo: number | null;
    chapterTitle: string;
    number: number | null;
    openingAr: string | null;
    hasChain: number;
  }[]) {
    if (!chapters.has(r.chapterId))
      chapters.set(r.chapterId, { id: r.chapterId, number: r.chapterNo, titleAr: r.chapterTitle, entries: [] });
    if (r.number != null)
      chapters
        .get(r.chapterId)!
        .entries.push({ number: r.number, openingAr: r.openingAr ?? '', hasChain: Boolean(r.hasChain) });
  }
  return { dataVersion, collection, book: b, chapters: [...chapters.values()], unplaced: [] };
}
