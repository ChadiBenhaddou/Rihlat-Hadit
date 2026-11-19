import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('bukhari', 'routes/bukhari.tsx'),
  route('bukhari/kitab/:n', 'routes/kitab.tsx'),
  route('bukhari/:number', 'routes/hadith.tsx'),
  route('narrator/:slug', 'routes/narrator.tsx'),
  route('compare/:a/:b', 'routes/compare.tsx'),
  route('search', 'routes/search.tsx'),
  route('methodology', 'routes/methodology.tsx'),
  route('sources', 'routes/sources.tsx'),
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
