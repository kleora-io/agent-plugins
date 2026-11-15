import { defineConfig } from 'vitest/config'

// The `node` environment: this package is a stdio process that talks to a
// fake `fetch` and a temp-directory credential store in its unit suite. There
// is no contract suite here: talking to a running Kleora is checked by hand,
// not by this package's `vitest run`.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 10_000,
  },
})
