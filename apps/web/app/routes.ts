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
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
