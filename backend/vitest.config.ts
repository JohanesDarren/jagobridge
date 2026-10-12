import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    // Hermetic env for modules that transitively call loadEnv(). Without this
    // the suite only passed where a developer's backend/.env happened to exist.
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/db/migrations/**", "src/db/seeds/**", "src/cli/**"],
    },
  },
});
