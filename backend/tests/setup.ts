/**
 * Vitest global setup.
 *
 * Several unit tests import modules that transitively load `core/env.ts`
 * (`logger.ts` -> `loadEnv()`), which validates required variables and throws
 * when they are absent. Locally that was masked by the developer's own
 * `backend/.env`; on CI there is no `.env`, so the suite failed with
 * "APP_SECRET_KEY: Required / JWT_SECRET_KEY: Required".
 *
 * Tests must not depend on a developer's local environment. Provide deterministic
 * throwaway values here so the suite is hermetic in any environment.
 *
 * These are test-only constants and must never be used to run the application.
 */
const TEST_DEFAULTS: Record<string, string> = {
  APP_ENV: "test",
  APP_SECRET_KEY: "test_app_secret_key_0000000000000000000000",
  JWT_SECRET_KEY: "test_jwt_secret_key_0000000000000000000000",
};

for (const [key, value] of Object.entries(TEST_DEFAULTS)) {
  // Do not clobber a real value if one is already present.
  if (!process.env[key]) process.env[key] = value;
}
