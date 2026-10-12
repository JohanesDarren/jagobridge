#!/usr/bin/env node
/**
 * Production-aware `dev` dispatcher.
 *
 * The hosting platform starts Node apps with `npm run dev`. On the runtime host
 * the sandbox forbids the thread count that `concurrently` + `tsx watch`
 * require, so the dev watchers abort with SIGABRT (exit 134) and nothing ever
 * listens on the assigned port -> nginx answers 502.
 *
 * In production we therefore run the compiled server instead. Locally (no
 * NODE_ENV=production) the normal dev watchers are used, so developer
 * experience is unchanged.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isProd =
  process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";

if (isProd) {
  const entry = path.join(root, "backend", "dist", "src", "server.js");
  if (!existsSync(entry)) {
    console.error("[dev] production mode but compiled entrypoint missing:", entry);
    process.exit(1);
  }
  console.log("[dev] production mode -> starting compiled server:", entry);
  const res = spawnSync(process.execPath, [entry], { cwd: root, stdio: "inherit" });
  process.exit(res.status ?? 1);
}

console.log("[dev] development mode -> starting watch servers");
const res = spawnSync("npm", ["run", "dev:local"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(res.status ?? 1);
