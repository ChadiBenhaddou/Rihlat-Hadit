/**
 * Response contracts for /api/v1 (SPEC §10). Every fact carries its citation
 * ids and a review status; the client resolves citation ids through `citations`.
 */
import { z } from 'zod';
import { Citation, IsnadGraph, ReviewStatus } from './schemas';

/** A source as shown to readers: secondary sources are labelled «مصدر ثانوي». */
export const SourceInfo = z.object({
  slug: z.string(),
  kind: z.enum(['primary_text', 'biographical', 'critical', 'dataset', 'web']),
  titleAr: z.string(),
  titleEn: z.string().nullable(),
  edition: z.string().nullable(),
  url: z.string().nullable(),
  license: z.string(),
  attribution: z.string().nullable(),
});
export type SourceInfo = z.infer<typeof SourceInfo>;

export const BookSummary = z.object({
  number: z.number().int(),
  titleAr: z.string(),
  chapterCount: z.number().int(),
  hadithCount: z.number().int(),
  firstNumber: z.number().int().nullable(),
  lastNumber: z.number().int().nullable(),
});
export type BookSummary = z.infer<typeof BookSummary>;

export const ChapterEntry = z.object({
  number: z.number().int(),
  openingAr: z.string(),
  hasChain: z.boolean(),
});

export const ChapterWithEntries = z.object({
  id: z.number().int(),
  number: z.number().int().nullable(),
  titleAr: z.string(),
  entries: z.array(ChapterEntry),
});

export const BookDetail = z.object({
  dataVersion: z.string(),
  collection: z.string(),
  book: BookSummary,
  chapters: z.array(ChapterWithEntries),
  /** Entries of this book whose chapter is not known (absent from the reference text). */
  unplaced: z.array(ChapterEntry),
});
export type BookDetail = z.infer<typeof BookDetail>;

export const BooksResponse = z.object({
  dataVersion: z.string(),
  collection: z.object({ slug: z.string(), nameAr: z.string(), nameEn: z.string().nullable() }),
  books: z.array(BookSummary),
  sources: z.array(SourceInfo),
});
export type BooksResponse = z.infer<typeof BooksResponse>;

export const HadithResponse = z.object({
  dataVersion: z.string(),
  collection: z.string(),
  number: z.number().int(),
  textAr: z.string(),
  isnadAr: z.string().nullable(),
  matnAr: z.string().nullable(),
  /** False when the displayed text has no tashkeel because only the Tawq al-Najat text exists. */
  vocalized: z.boolean(),
  book: z.object({ number: z.number().int(), titleAr: z.string() }).nullable(),
  chapter: z.object({ id: z.number().int(), number: z.number().int().nullable(), titleAr: z.string() }).nullable(),
  numbers: z.array(z.object({ scheme: z.string(), value: z.string() })),
  prev: z.number().int().nullable(),
  next: z.number().int().nullable(),
  groupId: z.number().int().nullable(),
  citationId: z.number().int(),
  reviewStatus: ReviewStatus,
  graph: IsnadGraph,
  /** Narrator mentions in textAr ([start, end) offsets), each tied to its graph node. */
  mentions: z.array(z.object({ start: z.number().int(), end: z.number().int(), nodeId: z.string() })),
  /** Every source cited in this response (graph.citations name them by slug). */
  sources: z.array(SourceInfo),
});
export type HadithResponse = z.infer<typeof HadithResponse>;

export const Grading = z.object({
  criticAr: z.string(),
  statementAr: z.string(),
  citationId: z.number().int(),
});

export const NarratorLink = z.object({
  slug: z.string(),
  nameAr: z.string(),
  deathAh: z.number().int().nullable(),
  count: z.number().int(),
});
export type NarratorLink = z.infer<typeof NarratorLink>;

export const NarratorProfile = z.object({
  dataVersion: z.string(),
  id: z.number().int(),
  slug: z.string(),
  displayNameAr: z.string(),
  fullNameAr: z.string().nullable(),
  honorificAr: z.string().nullable(),
  role: z.enum(['prophet', 'companion', 'narrator', 'compiler']),
  tabaqa: z.number().int().nullable(),
  birthAh: z.number().int().nullable(),
  deathAh: z.number().int().nullable(),
  deathAhMax: z.number().int().nullable(),
  datesCitationId: z.number().int().nullable(),
  /** Present only when a citation attributes it (decision 3 in docs/data-sources.md). */
  summaryGrade: z.object({ textAr: z.string(), citationId: z.number().int() }).nullable(),
  names: z.array(z.object({ formAr: z.string(), kind: z.string().nullable() })),
  places: z.array(z.object({ nameAr: z.string(), relation: z.string(), citationId: z.number().int().nullable() })),
  flags: z.array(z.object({ flag: z.enum(['tadlis', 'ikhtilat']), citationId: z.number().int() })),
  gradings: z.array(Grading),
  teachers: z.array(NarratorLink),
  students: z.array(NarratorLink),
  hadithCount: z.number().int(),
  hadithNumbers: z.array(z.number().int()),
  reviewStatus: ReviewStatus,
  citations: z.array(Citation),
  sources: z.array(SourceInfo),
});
export type NarratorProfile = z.infer<typeof NarratorProfile>;

export const HadithHit = z.object({
  kind: z.literal('hadith'),
  collection: z.string(),
  number: z.number().int(),
  textAr: z.string(),
  bookTitleAr: z.string().nullable(),
  chapterTitleAr: z.string().nullable(),
});
export const NarratorHit = z.object({
  kind: z.literal('narrator'),
  slug: z.string(),
  nameAr: z.string(),
  deathAh: z.number().int().nullable(),
  tabaqa: z.number().int().nullable(),
  placeAr: z.string().nullable(),
  hadithCount: z.number().int(),
});
export const SearchResponse = z.object({
  dataVersion: z.string(),
  query: z.string(),
  type: z.enum(['hadith', 'narrator']),
  /** Normalized query terms (surface and stem); the client highlights words of the original text that match. */
  terms: z.array(z.string()),
  /** Set when the query was a hadith number and it exists. */
  numberMatch: z.number().int().nullable(),
  results: z.array(z.discriminatedUnion('kind', [HadithHit, NarratorHit])),
  nextCursor: z.string().nullable(),
});
export type SearchResponse = z.infer<typeof SearchResponse>;

export const NetworkResponse = z.object({
  dataVersion: z.string(),
  center: z.string(),
  depth: z.number().int().min(1).max(2),
  truncated: z.boolean(),
  nodes: z.array(
    z.object({
      slug: z.string(),
      nameAr: z.string(),
      tabaqa: z.number().int().nullable(),
      deathAh: z.number().int().nullable(),
      role: z.string(),
    }),
  ),
  /** teacher → student, with the number of Bukhari entries carrying that link. */
  edges: z.array(z.object({ teacher: z.string(), student: z.string(), count: z.number().int() })),
});
export type NetworkResponse = z.infer<typeof NetworkResponse>;

export const SharedResponse = z.object({
  dataVersion: z.string(),
  a: z.string(),
  b: z.string(),
  /** Entries where the two are adjacent in a chain, either way round. */
  numbers: z.array(z.number().int()),
  nextCursor: z.string().nullable(),
});
export type SharedResponse = z.infer<typeof SharedResponse>;

export const DiffOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('same'), a: z.string(), b: z.string() }),
  z.object({ op: z.literal('added'), b: z.string() }),
  z.object({ op: z.literal('omitted'), a: z.string() }),
  z.object({ op: z.literal('changed'), a: z.string(), b: z.string() }),
]);

export const CompareResponse = z.object({
  dataVersion: z.string(),
  a: HadithResponse,
  b: HadithResponse,
  /** Matn A → matn B, word by word on normalized words; original words kept. */
  diff: z.array(DiffOpSchema),
});
export type CompareResponse = z.infer<typeof CompareResponse>;
