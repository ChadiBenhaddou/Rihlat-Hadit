/** Contract tests for the Phase 1 endpoints (SPEC §18), against a TEST FIXTURE. */
import { env } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import {
  BooksResponse,
  HadithResponse,
  IsnadGraph,
  NarratorProfile,
  ProblemDetails,
  SearchResponse,
} from '@isnad/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { ftsExpression } from '../../server/data/search';
import { seed } from './seed';

const get = (path: string) => exports.default.fetch(new Request(`https://example.test/api/v1${path}`));

beforeAll(async () => {
  await env.DB.prepare('DELETE FROM data_versions').run();
  await env.CONFIG.delete('data_version');
  await seed();
});

describe('hadith', () => {
  it('returns entry, numbers, chapter and a valid graph', async () => {
    const res = await get('/hadith/bukhari/1');
    expect(res.status).toBe(200);
    const body = HadithResponse.parse(await res.json());
    expect(body).toMatchObject({
      number: 1,
      dataVersion: 'fixture-v1',
      book: { number: 1 },
      chapter: { titleAr: 'باب-اختبار' },
    });
    expect(body.numbers).toEqual([{ scheme: 'in-book', value: '1:1' }]);
    expect(body.next).toBe(2);
    expect(body.sources.map((s) => s.kind)).toEqual(['dataset']);
  });

  it('merges routes, keeps the suspended link broken and finds the common link', async () => {
    const g = IsnadGraph.parse(await (await get('/hadith/bukhari/1/graph')).json());
    expect(g.chains).toHaveLength(2);
    expect(g.nodes.filter((n) => n.id === 'n:13')).toHaveLength(1);
    expect(g.edges.find((e) => e.from === 'n:15' && e.to === 'n:10')?.kind).toBe('suspended');
    expect(g.indicators.find((i) => i.key === 'common_link')?.valueAr).toBe('راوٍ-ج');
    expect(g.nodes.find((n) => n.role === 'prophet')?.honorificAr).toBe('\uFDFA');
    // Decision 3: the uncited summary grade never leaves the server.
    expect(JSON.stringify(g)).not.toContain('وصف غير منسوب');
  });

  it('marks unvocalized text and 404s with problem details', async () => {
    expect(HadithResponse.parse(await (await get('/hadith/bukhari/2')).json()).vocalized).toBe(false);
    const res = await get('/hadith/bukhari/999');
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toBe('application/problem+json');
    ProblemDetails.parse(await res.json());
    expect((await get('/hadith/bukhari/abc')).status).toBe(400);
  });
});

describe('books and narrators', () => {
  it('lists books with counts', async () => {
    const body = BooksResponse.parse(await (await get('/collections/bukhari/books')).json());
    expect(body.books[0]).toMatchObject({ number: 1, chapterCount: 1, hadithCount: 2, firstNumber: 1, lastNumber: 2 });
  });

  it('returns a cited narrator profile without the unattributed grade', async () => {
    const p = NarratorProfile.parse(await (await get('/narrators/r11')).json());
    expect(p).toMatchObject({
      displayNameAr: 'راوٍ-أ',
      deathAh: 219,
      datesCitationId: 4,
      summaryGrade: null,
      hadithNumbers: [1],
    });
    expect(p.gradings).toEqual([{ criticAr: 'ناقد-اختبار', statementAr: 'قول-اختبار', citationId: 5 }]);
    expect(p.teachers.map((t) => t.slug)).toEqual(['r12']);
    expect(p.students.map((t) => t.slug)).toEqual(['r10']);
    expect(p.citations.map((c) => c.id).sort()).toEqual([4, 5]);
  });
});

describe('search', () => {
  it('finds the matn with or without tashkeel and highlights terms', async () => {
    for (const q of ['الأعمال بالنيات', 'الْأَعْمَالُ بِالنِّيَّاتِ', 'الاعمال']) {
      const body = SearchResponse.parse(await (await get(`/search?q=${encodeURIComponent(q)}`)).json());
      expect(body.results[0]).toMatchObject({ kind: 'hadith', number: 1 });
    }
  });

  it('treats a number as a hadith-number lookup first', async () => {
    const body = SearchResponse.parse(await (await get('/search?q=%D9%A2')).json()); // «٢»
    expect(body.numberMatch).toBe(2);
    expect(body.results[0]).toMatchObject({ number: 2 });
  });

  it('searches narrators and validates input', async () => {
    const body = SearchResponse.parse(
      await (await get(`/search?type=narrator&q=${encodeURIComponent('راوٍ-أ')}`)).json(),
    );
    expect(body.results[0]).toMatchObject({ kind: 'narrator', slug: 'r11', deathAh: 219 });
    expect((await get('/search?q=')).status).toBe(400);
  });

  it('builds safe FTS expressions', () => {
    expect(ftsExpression('و')).toBeNull();
    expect(ftsExpression('"إنما الأعمال" بالنيات')?.expr).toBe(
      '{surface} : "انما الاعمال" AND ({surface} : "بالنيات" * OR {stem} : "نيات" *)',
    );
  });
});

describe('versioned paths', () => {
  it('serves the current version immutably and 404s an unknown one', async () => {
    const v = await get('/d/fixture-v1/hadith/bukhari/1');
    expect(v.status).toBe(200);
    expect(v.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect((await get('/hadith/bukhari/1')).headers.get('Cache-Control')).toBe('public, max-age=60');
    expect((await get('/d/old-version/hadith/bukhari/1')).status).toBe(404);
  });
});
