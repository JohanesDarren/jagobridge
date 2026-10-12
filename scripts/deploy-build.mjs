#!/usr/bin/env node
/**
 * Deploy-time build guard.
 *
 * The platform's PM2 runtime wrapper re-runs `npm run build` when it cannot
 * find compiled output by its own convention. On the runtime host only
 * production dependencies are installed, so a real tsc/vite build fails there
 * ("tsc: not found") even though the build stage already produced artefacts.
 *
 * This script makes `npm run build` idempotent and safe on the runtime host:
 *   - if the compiled artefacts are already present, exit 0 immediately
 *   - otherwise perform the real build (used on a cold checkout / local dev)
 *
 * Real build work lives in `build:deploy` (installs both workspaces including
 * dev dependencies, then compiles backend + frontend).
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED = [
  "backend/dist/src/server.js",
  "frontend/dist/index.html",
];

const missing = REQUIRED.filter((rel) => !existsSync(path.join(root, rel)));

if (missing.length === 0) {
  console.log("[build] compiled artefacts present - skipping rebuild");
  for (const rel of REQUIRED) console.log("[build]   ok:", rel);
  process.exit(0);
}

console.log("[build] missing artefacts:", missing.join(", "));
console.log("[build] running full build (build:deploy)");

const res = spawnSync("npm", ["run", "build:deploy"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (res.status !== 0) {
  console.error("[build] build:deploy failed with exit code", res.status);
  process.exit(res.status ?? 1);
}

const stillMissing = REQUIRED.filter((rel) => !existsSync(path.join(root, rel)));
if (stillMissing.length > 0) {
  console.error("[build] artefacts still missing after build:", stillMissing.join(", "));
  process.exit(1);
}

console.log("[build] build completed successfully");
