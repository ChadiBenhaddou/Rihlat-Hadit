/**
 * Schema and D1 behaviour inside the Workers runtime (SPEC §16).
 * TEST FIXTURE rows only: placeholder names, never content.
 */
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

async function tables(db: D1Database, type: 'table' | 'index' = 'table'): Promise<string[]> {
  const { results } = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
    )
    .bind(type)
    .all<{ name: string }>();
  return results.map((r) => r.name);
}

describe('core migrations', () => {
  it('create every section 7 table', async () => {
    expect(await tables(env.DB)).toEqual(
      expect.arrayContaining([
        'sources',
        'citations',
        'narrators',
        'narrator_names',
        'narrator_flags',
        'places',
        'narrator_places',
        'gradings',
        'collections',
        'books',
        'chapters',
        'hadith_groups',
        'hadiths',
        'hadith_numbers',
        'chains',
        'chain_links',
        'transmissions',
        'staff',
        'revisions',
        'reports',
        'data_versions',
      ]),
    );
  });

  it('keep virtual tables out of the core database (it must stay exportable)', async () => {
    const { results } = await env.DB.prepare("SELECT name FROM sqlite_master WHERE sql LIKE '%VIRTUAL TABLE%'").all();
    expect(results).toEqual([]);
  });

  it('enforce foreign keys', async () => {
    await expect(
      env.DB.prepare('INSERT INTO citations (source_id, locator) VALUES (999, ?)').bind('fixture').run(),
    ).rejects.toThrow(/FOREIGN KEY/i);
  });

  it('enforce CHECK constraints on review status', async () => {
    await expect(
      env.DB.prepare("INSERT INTO hadith_groups (method, review_status) VALUES ('manual', 'approved')").run(),
    ).rejects.toThrow(/CHECK/i);
  });
});

describe('search migrations', () => {
  it('create both FTS5 tables and accept a prefix query', async () => {
    const names = await tables(env.SEARCH_DB);
    expect(names).toEqual(expect.arrayContaining(['matn_fts', 'narrator_fts']));
    await env.SEARCH_DB.prepare('INSERT INTO matn_fts (hadith_id, collection, surface, stem) VALUES (1, ?, ?, ?)')
      .bind('fixture', 'انما الاعمال بالنيات', 'انما اعمال نيات')
      .run();
    const row = await env.SEARCH_DB.prepare(
      'SELECT hadith_id, bm25(matn_fts, 0, 0, 2.0, 1.0) AS score FROM matn_fts WHERE matn_fts MATCH ? ORDER BY score',
    )
      .bind('{surface stem}: نيا*')
      .first<{ hadith_id: number }>();
    expect(row?.hadith_id).toBe(1);
  });
});

describe('WITH RECURSIVE on D1', () => {
  it('walks a teacher → student chain through transmissions', async () => {
    // A placeholder five-narrator chain: fixture-1 taught fixture-2, … fixture-4 taught fixture-5.
    const stmts = [1, 2, 3, 4, 5].map((i) =>
      env.DB.prepare("INSERT INTO narrators (id, slug, display_name_ar) VALUES (?, ?, 'fixture')").bind(
        i,
        `fixture-${i}`,
      ),
    );
    for (const i of [1, 2, 3, 4]) {
      stmts.push(
        env.DB.prepare('INSERT INTO transmissions (teacher_id, student_id, hadith_count) VALUES (?, ?, 1)').bind(
          i,
          i + 1,
        ),
      );
    }
    await env.DB.batch(stmts);

    const { results } = await env.DB.prepare(
      `WITH RECURSIVE up(id, depth) AS (
         SELECT ?, 0
         UNION ALL
         SELECT t.teacher_id, up.depth + 1 FROM transmissions t JOIN up ON t.student_id = up.id WHERE up.depth < 10
       )
       SELECT id, depth FROM up ORDER BY depth`,
    )
      .bind(5)
      .all<{ id: number; depth: number }>();

    expect(results.map((r) => r.id)).toEqual([5, 4, 3, 2, 1]);
    expect(results.at(-1)?.depth).toBe(4);
  });
});
