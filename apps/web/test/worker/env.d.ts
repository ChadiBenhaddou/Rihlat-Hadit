import type { D1Migration } from '@cloudflare/vitest-plugin';

declare global {
  namespace Cloudflare {
    interface Env {
      CORE_MIGRATIONS: D1Migration[];
      SEARCH_MIGRATIONS: D1Migration[];
    }
  }
}
