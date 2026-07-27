import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-secret-test-secret-test-secret-test",
    },
    // PGlite spins up per suite; keep suites in one process so the
    // setDbForTests handle is shared with the app under test.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
