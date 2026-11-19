import type { Db } from './db';

/** Sentinel used before the first data publish. It is not a data version and never names content. */
export const UNPUBLISHED = 'unpublished';

/**
 * The active data version keys every cache (SPEC §8 step 9, §10).
 * CONFIG.data_version is authoritative; the latest data_versions row is the fallback.
 */
export async function currentDataVersion(env: Env, db: Db): Promise<string> {
  const fromKv = await env.CONFIG.get('data_version');
  if (fromKv) return fromKv;
  const row = await db
    .prepare('SELECT label FROM data_versions ORDER BY published_at DESC, id DESC LIMIT 1')
    .first<{ label: string }>();
  return row?.label ?? UNPUBLISHED;
}
