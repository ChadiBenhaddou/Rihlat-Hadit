/**
 * Every D1 query goes through a session (SPEC §4), so read replication can be
 * switched on later without touching call sites. See docs/adr/0005.
 */
export type Db = D1DatabaseSession;

/** A session for one request against the core database. */
export function coreDb(env: Env, bookmark?: string | null): Db {
  // Writes pass 'first-primary'; reads may use any replica.
  return env.DB.withSession(bookmark ?? 'first-unconstrained');
}

/** A session against the search database (FTS5 only). */
export function searchDb(env: Env, bookmark?: string | null): Db {
  return env.SEARCH_DB.withSession(bookmark ?? 'first-unconstrained');
}
