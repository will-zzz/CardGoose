import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/types/**',
        'src/test-setup.ts',
        'src/test/**',
        /** PrismaClient singleton; requires DB — all route tests mock `../lib/prisma.js` */
        'src/lib/prisma.ts',
        /** Thin process bootstrap; exercised in deployment / manual smoke only */
        'src/index.ts',
        /** Production-only SPA fallback + `sendFile`; local tests hit `/health` + `/api/*` only */
        'src/app.ts',
      ],
    },
  },
});
