import type { Route } from './+types/robots';

/** SPEC §15: block /admin and /api; point crawlers at the sitemap. */
export function loader({ request }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const body = ['User-agent: *', 'Disallow: /admin', 'Disallow: /api', '', `Sitemap: ${origin}/sitemap.xml`, ''].join(
    '\n',
  );
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
