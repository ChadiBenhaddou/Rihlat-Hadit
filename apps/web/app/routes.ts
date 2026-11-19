import { type RouteConfig, index, route } from '@react-router/dev/routes';

/** Public pages, mounted at / (Arabic) and again under /en (English) with distinct ids. */
const PAGES: [string, string][] = [
  ['bukhari', 'routes/bukhari.tsx'],
  ['bukhari/kitab/:n', 'routes/kitab.tsx'],
  ['bukhari/:number', 'routes/hadith.tsx'],
  ['narrator/:slug', 'routes/narrator.tsx'],
  ['compare/:a/:b', 'routes/compare.tsx'],
  ['search', 'routes/search.tsx'],
  ['methodology', 'routes/methodology.tsx'],
  ['sources', 'routes/sources.tsx'],
];

export default [
  index('routes/home.tsx'),
  ...PAGES.map(([path, file]) => route(path, file)),
  route('en', 'routes/home.tsx', { id: 'en-home' }),
  ...PAGES.map(([path, file]) => route(`en/${path}`, file, { id: `en-${path}` })),
  route('robots.txt', 'routes/robots.ts'),
  route('sitemap.xml', 'routes/sitemap.ts', { id: 'sitemap-index' }),
  route('sitemap/:part.xml', 'routes/sitemap.ts', { id: 'sitemap-part' }),
  route('admin', 'routes/admin/layout.tsx', [
    index('routes/admin/dashboard.tsx'),
    route('queue', 'routes/admin/queue.tsx'),
    route('item/:id', 'routes/admin/item.tsx'),
    route('narrator/:slug', 'routes/admin/narrator.tsx'),
    route('proposals', 'routes/admin/proposals.tsx'),
    route('reports', 'routes/admin/reports.tsx'),
    route('staff', 'routes/admin/staff.tsx'),
    route('publish', 'routes/admin/publish.tsx'),
  ]),
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
