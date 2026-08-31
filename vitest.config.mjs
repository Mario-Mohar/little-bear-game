import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.mjs"],
    // server/middleware/auth.js refuses to load without a secret and calls
    // process.exit(1) -- deliberately, so a deployment cannot come up with a
    // secret from the repository. The tests need one before they import it.
    env: { JWT_SECRET: "test-secret-not-used-anywhere-real" },
  },
});
