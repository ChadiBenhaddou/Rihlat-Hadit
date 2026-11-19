/**
 * The one Worker (SPEC §5): /api/v1 → Hono, everything else → React Router.
 * Loaders call the same data-access layer as the API, never the API over HTTP.
 */
import { Hono } from 'hono';
import { createRequestHandler, RouterContextProvider } from 'react-router';
import { cloudflareContext, nonceContext } from '../app/context';
import { api } from '../server/api';
import { securityHeaders, type SecurityVariables } from '../server/security';

const requestHandler = createRequestHandler(() => import('virtual:react-router/server-build'), import.meta.env.MODE);

const app = new Hono<{ Bindings: Env; Variables: SecurityVariables }>();

app.use('*', securityHeaders);
app.route('/api/v1', api);
app.all('*', (c) => {
  const context = new RouterContextProvider();
  // Hono types executionCtx with its own narrower interface; it is the runtime's ExecutionContext.
  context.set(cloudflareContext, { env: c.env, ctx: c.executionCtx as unknown as ExecutionContext });
  context.set(nonceContext, c.get('nonce'));
  return requestHandler(c.req.raw, context);
});

export default app satisfies ExportedHandler<Env>;
