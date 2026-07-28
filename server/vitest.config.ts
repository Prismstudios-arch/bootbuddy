import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-secret-test-secret-test-secret-test",
      // env.ts snapshots process.env at import time, so anything a test
      // needs must be set here rather than in the test body.
      REVENUECAT_WEBHOOK_AUTH: "test-webhook-secret",
      PROMO_CODES: "BOOTSALE-TEST-CODE,SECOND-CODE",
    },
    // PGlite spins up per suite; keep suites in one process so the
    // setDbForTests handle is shared with the app under test.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
