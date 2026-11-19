/** Loader helpers: loaders call the data layer directly, never the API over HTTP (SPEC §5). */
import type { RouterContextProvider } from 'react-router';
import { cloudflareContext } from '~/context';
import { coreDb, searchDb } from '../../server/db';
import { currentDataVersion } from '../../server/version';

export async function dataContext(context: Readonly<RouterContextProvider>) {
  const { env } = context.get(cloudflareContext);
  const db = coreDb(env);
  const dataVersion = await currentDataVersion(env, db);
  return { env, db, search: searchDb(env), dataVersion };
}

export function notFound(message = 'غير موجود'): never {
  throw new Response(message, { status: 404 });
}
