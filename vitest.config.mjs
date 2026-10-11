import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.mjs"],
    // server/middleware/auth.js refuses to load without a secret and calls
    // process.exit(1) -- deliberately, so a deployment cannot come up with a
    // secret from the repository. The tests need one before they import it.
    // config/db.js exits without DATABASE_URL as well. pg only connects on the
    // first query, and the app tests stub every query they trigger.
    env: {
      JWT_SECRET: "test-secret-not-used-anywhere-real",
      DATABASE_URL: "postgres://test@127.0.0.1:1/unused",
    },
  },
});
