import { applyD1Migrations, env } from 'cloudflare:test';

// Setup files run outside per-test storage isolation, so this applies once per file.
await applyD1Migrations(env.DB, env.CORE_MIGRATIONS);
await applyD1Migrations(env.SEARCH_DB, env.SEARCH_MIGRATIONS);
