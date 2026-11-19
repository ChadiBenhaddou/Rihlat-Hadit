/**
 * Chunked sitemap generated from D1 (SPEC §15): /sitemap.xml is an index of
 * /sitemap/<part>.xml files, each at most 5,000 URLs.
 */
import { dataContext } from '~/lib/data.server';
import type { Route } from './+types/sitemap';

const PER = 5000;
const xml = (body: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const { db } = await dataContext(context);
  const urls: string[] = ['/', '/bukhari', '/methodology', '/sources'];
  const [books, hadiths, narrators] = await db.batch([
    db.prepare('SELECT number FROM books ORDER BY number'),
    db.prepare('SELECT ref_number AS n FROM hadiths ORDER BY ref_number'),
    db.prepare("SELECT slug FROM narrators WHERE role != 'prophet' ORDER BY id"),
  ]);
  for (const b of (books?.results ?? []) as { number: number }[]) urls.push(`/bukhari/kitab/${b.number}`);
  for (const h of (hadiths?.results ?? []) as { n: number }[]) urls.push(`/bukhari/${h.n}`);
  for (const n of (narrators?.results ?? []) as { slug: string }[]) urls.push(`/narrator/${n.slug}`);
  const parts = Math.ceil(urls.length / PER);
  if (!params.part) {
    const items = Array.from(
      { length: parts },
      (_, i) => `<sitemap><loc>${origin}/sitemap/${i + 1}.xml</loc></sitemap>`,
    ).join('');
    return xml(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`);
  }
  const part = Number(params.part);
  if (!Number.isInteger(part) || part < 1 || part > parts) throw new Response('Not Found', { status: 404 });
  const slice = urls.slice((part - 1) * PER, part * PER);
  return xml(
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${slice.map((u) => `<url><loc>${origin}${u}</loc></url>`).join('')}</urlset>`,
  );
}
