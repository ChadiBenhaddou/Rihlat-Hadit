import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: { name: 'node', include: ['test/node/**/*.test.ts'], environment: 'node' },
      },
      {
        plugins: [
          cloudflareTest(async () => ({
            // The real entry imports React Router's virtual server build, which only
            // exists under the Vite app build; the test entry mounts the same API.
            main: './test/worker/entry.ts',
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: {
              bindings: {
                CORE_MIGRATIONS: await readD1Migrations('./migrations'),
                SEARCH_MIGRATIONS: await readD1Migrations('./migrations-search'),
                TURNSTILE_SECRET: 'test-secret',
              },
            },
          })),
        ],
        test: {
          name: 'worker',
          include: ['test/worker/**/*.test.ts'],
          setupFiles: ['./test/worker/apply-migrations.ts'],
        },
      },
    ],
  },
});
