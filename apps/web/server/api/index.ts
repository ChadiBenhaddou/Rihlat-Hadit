import { Hono } from 'hono';
import { VersionResponse } from '@isnad/shared';
import { coreDb } from '../db';
import { problem } from '../problem';
import { currentDataVersion } from '../version';

export const api = new Hono<{ Bindings: Env }>();

api.get('/version', async (c) => {
  const dataVersion = await currentDataVersion(c.env, coreDb(c.env));
  const body = VersionResponse.parse({ dataVersion });
  return c.json(body, 200, { 'Cache-Control': 'public, max-age=60' });
});

// Hono does not carry a sub-app's notFound through app.route(), so the API ends
// with its own catch-all; otherwise unknown /api/v1 paths would reach React Router.
api.all('*', (c) => problem(c, 404, 'Not Found'));
api.onError((err, c) => {
  console.error(
    JSON.stringify({ level: 'error', msg: 'api_error', path: new URL(c.req.url).pathname, error: String(err) }),
  );
  return problem(c, 500, 'Internal Server Error');
});
