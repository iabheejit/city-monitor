import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        // Limit parallel workers to avoid OOM — each fork loads the full
        // server module graph (express, drizzle, openai, etc.)
        maxForks: 3,
      },
    },
  },
});
