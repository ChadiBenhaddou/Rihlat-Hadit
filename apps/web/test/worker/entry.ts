/** Test entry: the production Worker minus the React Router handler. */
import { Hono } from 'hono';
import { api } from '../../server/api';
import { securityHeaders, type SecurityVariables } from '../../server/security';

const app = new Hono<{ Bindings: Env; Variables: SecurityVariables }>();
app.use('*', securityHeaders);
app.route('/api/v1', api);

export default app satisfies ExportedHandler<Env>;
