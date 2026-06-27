#!/usr/bin/env node
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (!arg.startsWith("--")) continue;
  const [key, inlineValue] = arg.split("=", 2);
  const value = inlineValue ?? (process.argv[i + 1]?.startsWith("--") ? "true" : process.argv[++i] ?? "true");
  args.set(key, value);
}

function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function expectedModelCacheVersion() {
  const source = readFileSync(path.join(repoRoot, "server", "model-cache-version.ts"), "utf8");
  const match = source.match(/MODEL_CACHE_VERSION\s*=\s*"([^"]+)"/);
  if (!match) throw new Error("Could not read MODEL_CACHE_VERSION from server/model-cache-version.ts");
  return match[1];
}

const baseUrl = String(args.get("--base") ?? process.env.FUPIT_BASE_URL ?? "https://fupit.com").replace(/\/+$/, "");
const expectedCommit =
  args.get("--expect-commit") ??
  process.env.FUPIT_EXPECT_COMMIT ??
  (args.has("--skip-commit") || process.env.FUPIT_SKIP_COMMIT === "1" ? null : gitHead());
const requireFresh = args.has("--require-fresh") || process.env.FUPIT_REQUIRE_FRESH === "1";
const skipTrajectory = args.has("--skip-trajectory") || process.env.FUPIT_SKIP_TRAJECTORY === "1";
const lat = Number(args.get("--lat") ?? process.env.FUPIT_SMOKE_LAT ?? 60.17);
const lng = Number(args.get("--lng") ?? process.env.FUPIT_SMOKE_LNG ?? 24.94);
const year = Number(args.get("--year") ?? process.env.FUPIT_SMOKE_YEAR ?? 2050);
const scenario = String(args.get("--scenario") ?? process.env.FUPIT_SMOKE_SCENARIO ?? "ssp585");
const expectedCacheVersion = expectedModelCacheVersion();

const failures = [];
const checks = [];

function pass(message) {
  checks.push(`ok ${checks.length + 1} - ${message}`);
}

function fail(message) {
  failures.push(message);
  checks.push(`not ok ${checks.length + 1} - ${message}`);
}

function assert(condition, message) {
  if (condition) pass(message);
  else fail(message);
}

function commitMatches(actual, expected) {
  if (!actual || !expected) return false;
  const a = String(actual);
  const e = String(expected);
  return a === e || a.startsWith(e) || e.startsWith(a);
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getText(pathname) {
  const res = await fetchWithTimeout(`${baseUrl}${pathname}`, {
    headers: { "user-agent": "fupit-live-release-verifier/1.0" },
  });
  return { res, text: await res.text() };
}

async function getJson(pathname) {
  const { res, text } = await getText(pathname);
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`${pathname} returned ${res.status} ${contentType}; body starts: ${text.slice(0, 160).replace(/\s+/g, " ")}`);
  }
  return { res, json: JSON.parse(text) };
}

function nullPaths(value, prefix = "$", out = []) {
  if (value === null) {
    out.push(prefix);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => nullPaths(item, `${prefix}[${index}]`, out));
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) nullPaths(item, `${prefix}.${key}`, out);
  }
  return out;
}

try {
  const { json: health } = await getJson("/api/health");
  assert(health.ok === true, "health ok=true");
  assert(health.app === "fupit", "health app=fupit");
  assert(health.engine === "grounded_model.py", "health engine is grounded_model.py");
  assert(health.modelCacheVersion === expectedCacheVersion, `health model cache version is ${expectedCacheVersion}`);
  assert(health.cachePurge === "startup-incompatible-delete-enabled", "startup cache purge enabled");
  assert(health.legacyProjectionEndpoints === "410-gone", "health marks legacy projection endpoints gone");
  assert(Array.isArray(health.routes) && health.routes.includes("/methodology"), "health exposes /methodology route");
  if (expectedCommit) {
    assert(commitMatches(health.deployment?.commit, expectedCommit), `health deployment commit matches ${String(expectedCommit).slice(0, 12)}`);
  }

  const methodology = await getText("/methodology");
  assert(methodology.res.status === 200, "GET /methodology returns 200");
  assert(methodology.text.includes("WorldClim v2.1"), "/methodology mentions WorldClim v2.1");
  assert(methodology.text.includes("Fick & Hijmans 2017"), "/methodology cites Fick & Hijmans 2017");
  assert(methodology.text.includes("No fabricated") || methodology.text.includes("do not invent"), "/methodology carries no-fabricated-science copy");

  const robots = await getText("/robots.txt");
  assert(robots.res.status === 200, "GET /robots.txt returns 200");
  assert(robots.text.includes("Sitemap: https://fupit.com/sitemap.xml"), "robots.txt points at fupit.com sitemap");

  const sitemap = await getText("/sitemap.xml");
  assert(sitemap.res.status === 200, "GET /sitemap.xml returns 200");
  assert(sitemap.text.includes("https://fupit.com/methodology"), "sitemap includes /methodology");

  const legacyProjection = await getText("/api/projections?locationId=1&year=2050");
  assert(legacyProjection.res.status === 410, "legacy /api/projections returns 410");
  const legacyComparison = await getText("/api/climate/multi-comparison?locationIds=1&year=2050");
  assert(legacyComparison.res.status === 410, "legacy /api/climate/multi-comparison returns 410");

  if (skipTrajectory) {
    pass("trajectory endpoint skipped by --skip-trajectory");
  } else {
    const trajectoryRes = await fetchWithTimeout(`${baseUrl}/api/climate-trajectory`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "fupit-live-release-verifier/1.0",
      },
      body: JSON.stringify({ coordinates: { lat, lng }, years: [year], scenario }),
    });
    const trajectoryText = await trajectoryRes.text();
    assert(trajectoryRes.status === 200, "POST /api/climate-trajectory returns 200");
    const trajectory = JSON.parse(trajectoryText);
    assert(trajectory.success === true, "trajectory success=true");
    assert(Number.isInteger(trajectory.data?.cachedCount), "trajectory reports cachedCount");
    if (requireFresh) {
      assert(trajectory.data.cachedCount === 0, "trajectory was freshly generated, not served from cache");
    }
    const point = trajectory.data?.points?.[0];
    assert(Boolean(point), "trajectory has first point");
    assert(point?.year === year, `trajectory first point year=${year}`);
    assert(point?.scenario === scenario, `trajectory point scenario=${scenario}`);
    assert(point?.metadata?.scenario === scenario, `trajectory metadata scenario=${scenario}`);
    assert(typeof point?.habitability?.score === "number", "habitability.score is numeric");
    assert(Array.isArray(point?.temperature?.monthly) && point.temperature.monthly.length === 12, "temperature.monthly has length 12");
    assert(Array.isArray(point?.precipitation?.monthly) && point.precipitation.monthly.length === 12, "precipitation.monthly has length 12");
    assert(typeof point?.precipitation?.annual_total === "number", "precipitation.annual_total is numeric");
    assert(typeof point?.extremes?.drought_risk === "number", "extremes.drought_risk is numeric");
    assert(typeof point?.metadata?.baseline_source?.temperature === "string", "metadata.baseline_source.temperature present");
    assert(typeof point?.metadata?.baseline_source?.precipitation === "string", "metadata.baseline_source.precipitation present");
    assert(String(point?.metadata?.baseline_source?.temperature).includes("WorldClim"), "temperature baseline is WorldClim for smoke coordinate");
    assert(String(point?.metadata?.baseline_source?.precipitation).includes("WorldClim"), "precipitation baseline is WorldClim for smoke coordinate");
    assert(Array.isArray(point?.metadata?.source_trail) && point.metadata.source_trail.some((entry) => entry.label === "Observed baseline"), "source trail includes observed baseline");
    const nulls = nullPaths(point);
    assert(nulls.length === 0, `trajectory point has zero nulls${nulls.length ? ` (${nulls.slice(0, 5).join(", ")})` : ""}`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

console.log(checks.join("\n"));
if (failures.length > 0) {
  console.error(`\n${failures.length} live-release verification failure(s) for ${baseUrl}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`\nlive-release verification passed for ${baseUrl}`);
