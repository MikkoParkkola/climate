#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverEntry = path.join(repoRoot, "dist", "index.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : undefined;
      server.close(() => {
        if (port) resolve(port);
        else reject(new Error("could not allocate a local port"));
      });
    });
  });
}

async function waitForHealth(baseUrl, server) {
  const deadline = Date.now() + 10_000;
  let lastError = "";
  while (Date.now() < deadline) {
    if (server.exitCode != null) {
      throw new Error(`server exited early with code ${server.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`server did not become healthy: ${lastError}`);
}

async function expectStatus(baseUrl, pathname, options, expectedStatus, label) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  assert(
    response.status === expectedStatus,
    `${label} expected HTTP ${expectedStatus}, got ${response.status}`,
  );
  return response;
}

assert(existsSync(serverEntry), "dist/index.js missing; run npm run build before smoke:db-free-release");

const port = await findOpenPort();
const env = { ...process.env, NODE_ENV: "production", PORT: String(port) };
delete env.DATABASE_URL;

const server = spawn(process.execPath, [serverEntry], {
  cwd: repoRoot,
  env,
  stdio: ["ignore", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";
server.stdout.on("data", (chunk) => {
  stdout += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

try {
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHealth(baseUrl, server);
  execFileSync(
    process.execPath,
    ["scripts/verify-live-release.mjs", "--base", baseUrl, "--skip-trajectory", "--skip-commit"],
    {
      cwd: repoRoot,
      env: { ...process.env, FUPIT_SKIP_TRAJECTORY: "1", FUPIT_SKIP_COMMIT: "1" },
      stdio: "inherit",
    },
  );
  // Location search is geocoder-backed and no longer needs a database. Without
  // DATABASE_URL it still returns 200 (live geocoder results, or an empty array
  // if both the geocoder and the DB fallback are unavailable).
  await expectStatus(
    baseUrl,
    "/api/locations/search?q=he",
    undefined,
    200,
    "geocoder-backed location search without DATABASE_URL",
  );
  await expectStatus(
    baseUrl,
    "/api/climate-trajectory",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ coordinates: { lat: 60.17, lng: 24.94 }, years: [2050], scenario: "ssp245" }),
    },
    503,
    "DB-backed climate trajectory without DATABASE_URL",
  );
  await expectStatus(
    baseUrl,
    "/api/climate-twin?lat=60.17&lng=24.94&year=2050&scenario=ssp245",
    undefined,
    503,
    "DB-backed climate twin without DATABASE_URL",
  );
  console.log(`db-free release smoke passed for ${baseUrl}`);
} catch (error) {
  console.error(stdout.trim());
  console.error(stderr.trim());
  throw error;
} finally {
  server.kill("SIGTERM");
}
