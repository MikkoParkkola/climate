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
  assert(health.engine === "grounded-node-model.ts", "health engine is grounded-node-model.ts");
  assert(health.gridEngine === "node", "health grid engine defaults to node");
  assert(health.modelCacheVersion === expectedCacheVersion, `health model cache version is ${expectedCacheVersion}`);
  if (skipTrajectory) {
    assert(
      ["startup-incompatible-delete-enabled", "skipped-no-database"].includes(health.cachePurge),
      "health reports cache purge state for read-only verification",
    );
  } else {
    assert(health.databaseConfigured === true, "health reports database configured for trajectory verification");
    assert(health.cachePurge === "startup-incompatible-delete-enabled", "startup cache purge enabled");
  }
  assert(health.legacyProjectionEndpoints === "410-gone", "health marks legacy projection endpoints gone");
  assert(Array.isArray(health.routes) && health.routes.includes("/methodology"), "health exposes /methodology route");
  assert(Array.isArray(health.routes) && health.routes.includes("/rankings"), "health exposes /rankings route");
  assert(Array.isArray(health.routes) && health.routes.includes("/data-quality"), "health exposes /data-quality route");
  assert(Array.isArray(health.apiRoutes) && health.apiRoutes.includes("/api/climate-twin"), "health exposes /api/climate-twin route");
  assert(Array.isArray(health.apiRoutes) && health.apiRoutes.includes("/api/data-quality"), "health exposes /api/data-quality route");
  assert(Array.isArray(health.retiredEndpoints) && health.retiredEndpoints.includes("/api/user/keys"), "health exposes retired API-key endpoint guard");
  assert(Array.isArray(health.supportedScenarios) && health.supportedScenarios.includes("ssp126"), "health exposes supported full-forecast scenarios");
  assert(Array.isArray(health.supportedScenarios) && !health.supportedScenarios.includes("ssp119"), "health excludes SSP1-1.9 from full forecasts");
  if (expectedCommit) {
    assert(commitMatches(health.deployment?.commit, expectedCommit), `health deployment commit matches ${String(expectedCommit).slice(0, 12)}`);
  }

  const methodology = await getText("/methodology");
  assert(methodology.res.status === 200, "GET /methodology returns 200");
  assert(methodology.text.includes("WorldClim v2.1"), "/methodology mentions WorldClim v2.1");
  assert(methodology.text.includes("Fick & Hijmans 2017"), "/methodology cites Fick & Hijmans 2017");
  assert(methodology.text.includes("Humid heat screen"), "/methodology exposes humid heat screen copy");
  assert(methodology.text.includes("Stull 2011"), "/methodology cites Stull 2011 wet-bulb source");
  assert(methodology.text.includes("Cold-season context"), "/methodology exposes cold-season context copy");
  assert(methodology.text.includes("daily freeze days"), "/methodology caveats cold-season context as non-daily");
  assert(methodology.text.includes("No fabricated") || methodology.text.includes("do not invent"), "/methodology carries no-fabricated-science copy");

  const rankingsPage = await getText("/rankings");
  assert(rankingsPage.res.status === 200, "GET /rankings returns 200");
  assert(rankingsPage.text.includes("bounded climate rankings"), "/rankings carries bounded-ranking copy");
  assert(rankingsPage.text.includes("not complete global"), "/rankings avoids complete-global claim");
  assert(rankingsPage.text.includes("Natural Earth"), "/rankings exposes Natural Earth population-place catalog copy");
  assert(rankingsPage.text.includes("country aggregate"), "/rankings exposes bounded country aggregate copy");

  const { json: ranking } = await getJson("/api/climate/global-rankings?catalog=curated_cities&scenario=ssp245&year=2050&metric=habitability_score&direction=highest&limit=10");
  assert(ranking.catalog === "curated_cities", "ranking API uses curated_cities catalog");
  assert(ranking.catalogSize === 45, "ranking API discloses catalog size");
  assert(ranking.scenario === "ssp245", "ranking API scenario=ssp245");
  assert(ranking.year === 2050, "ranking API year=2050");
  assert(ranking.metric === "habitability_score", "ranking API metric=habitability_score");
  assert(Array.isArray(ranking.rows) && ranking.rows.length === 10, "ranking API returns top 10 rows");
  assert(Array.isArray(ranking.sourceIds) && ranking.sourceIds.includes("curated-ranking-cities-v1"), "ranking API exposes source IDs");
  assert(Array.isArray(ranking.caveats) && ranking.caveats.some((caveat) => caveat.includes("not complete global rankings")), "ranking API exposes bounded-catalog caveat");

  const { json: naturalRanking } = await getJson("/api/climate/global-rankings?catalog=natural_earth_populated_places_110m&scenario=ssp245&year=2050&metric=heat_stress_days&direction=highest&limit=10");
  assert(naturalRanking.catalog === "natural_earth_populated_places_110m", "Natural Earth ranking API uses population-place catalog");
  assert(naturalRanking.catalogSize >= 50, "Natural Earth ranking API discloses catalog size");
  assert(Array.isArray(naturalRanking.rows) && naturalRanking.rows.length === 10, "Natural Earth ranking API returns top 10 rows");
  assert(Array.isArray(naturalRanking.sourceIds) && naturalRanking.sourceIds.includes("natural-earth-populated-places-110m-v5"), "Natural Earth ranking API exposes source ID");
  assert(naturalRanking.rows.every((row) => Number.isFinite(row.population) && row.population >= 3_000_000), "Natural Earth ranking rows expose population threshold metadata");
  assert(Array.isArray(naturalRanking.caveats) && naturalRanking.caveats.some((caveat) => caveat.includes("pop_max >= 3,000,000")), "Natural Earth ranking API exposes bounded-catalog caveat");

  const { json: countryRanking } = await getJson("/api/climate/global-rankings?catalog=natural_earth_country_population_place_weighted&scenario=ssp245&year=2050&metric=heat_stress_days&direction=highest&limit=10");
  assert(countryRanking.catalog === "natural_earth_country_population_place_weighted", "country aggregate ranking API uses bounded country catalog");
  assert(countryRanking.catalogSize >= 25, "country aggregate ranking API discloses catalog size");
  assert(countryRanking.placeSampleSize >= 50, "country aggregate ranking API discloses place sample size");
  assert(Array.isArray(countryRanking.rows) && countryRanking.rows.length === 10, "country aggregate ranking API returns top 10 rows");
  assert(
    Array.isArray(countryRanking.sourceIds) &&
      countryRanking.sourceIds.includes("natural-earth-country-population-weighted-v1") &&
      countryRanking.sourceIds.includes("natural-earth-populated-places-110m-v5"),
    "country aggregate ranking API exposes source IDs",
  );
  assert(countryRanking.rows.every((row) => row.country === "country aggregate" && row.placeCount >= 1), "country aggregate ranking rows expose included-place counts");
  assert(
    Array.isArray(countryRanking.caveats) &&
      countryRanking.caveats.some((caveat) => caveat.includes("not a complete national exposure")),
    "country aggregate ranking API exposes national-exposure caveat",
  );

  const { json: sourceRegistry } = await getJson("/api/source-registry");
  assert(sourceRegistry.version === "source-registry-v1", "source-registry API version is source-registry-v1");
  assert(Array.isArray(sourceRegistry.rows) && sourceRegistry.rows.length >= 14, "source-registry API exposes current source rows");
  assert(
    sourceRegistry.rows.some(
      (row) =>
        row.sourceId === "unep-egr-2025-current-policies" &&
        row.displayPolicy === "show-as-policy-context-no-local-correction",
    ),
    "source-registry API exposes UNEP current-policy source row",
  );
  assert(
    sourceRegistry.rows.some(
      (row) =>
        row.sourceId === "cat-2025-warming-projections" &&
        row.displayPolicy === "show-as-policy-context-no-local-correction",
    ),
    "source-registry API exposes CAT warming-projection source row",
  );
  assert(
    sourceRegistry.rows.some(
      (row) =>
        row.sourceId === "natural-earth-populated-places-110m-v5" &&
        row.displayPolicy === "show-with-bounded-catalog-caveat",
    ),
    "source-registry API exposes Natural Earth population-place row",
  );
  assert(
    sourceRegistry.rows.some(
      (row) =>
        row.sourceId === "natural-earth-coastline-110m-v5" &&
        row.displayPolicy === "show-with-coastal-proximity-caveat",
    ),
    "source-registry API exposes Natural Earth coastline row",
  );
  assert(
    sourceRegistry.rows.some(
      (row) =>
        row.sourceId === "natural-earth-country-population-weighted-v1" &&
        row.displayPolicy === "show-with-country-aggregate-caveat",
    ),
    "source-registry API exposes Natural Earth country aggregate row",
  );
  assert(
    sourceRegistry.rows.some(
      (row) =>
        row.sourceId === "stull-2011-wetbulb-approximation" &&
        row.displayPolicy === "show-as-derived-screening-context-not-advice",
    ),
    "source-registry API exposes humid heat wet-bulb method row",
  );

  const dataQualityPage = await getText("/data-quality");
  assert(dataQualityPage.res.status === 200, "GET /data-quality returns 200");
  assert(dataQualityPage.text.includes("fupit data quality"), "/data-quality carries data-quality heading");
  assert(dataQualityPage.text.includes("artifact hashes"), "/data-quality mentions artifact hashes");
  assert(dataQualityPage.text.includes("Enrichment readiness ledger"), "/data-quality exposes enrichment readiness ledger");

  const { json: dataQuality } = await getJson("/api/data-quality");
  assert(dataQuality.version === "data-quality-v1", "data-quality API version is data-quality-v1");
  assert(Array.isArray(dataQuality.artifacts) && dataQuality.artifacts.length >= 10, "data-quality API exposes artifact hashes");
  assert(dataQuality.sourceRegistry?.rowCount >= 14, "data-quality API exposes complete source-registry rows");
  assert(
    dataQuality.enrichmentReadiness?.some((item) => item.key === "humid_heat" && item.status === "partial"),
    "data-quality API exposes partial humid heat readiness",
  );
  assert(
    dataQuality.enrichmentReadiness?.some(
      (item) =>
        item.key === "cold_season_context" &&
        item.status === "partial" &&
        String(item.publicBehavior).includes("monthly-mean freeze-month"),
    ),
    "data-quality API exposes partial cold-season context readiness",
  );
  assert(
    dataQuality.enrichmentReadiness?.some(
      (item) =>
        item.key === "cold_season_context" &&
        String(item.missingForFullUse).includes("daily cold extreme indices"),
    ),
    "data-quality API keeps daily cold-stress gap explicit",
  );
  assert(
    dataQuality.enrichmentReadiness?.some(
      (item) =>
        item.key === "freshwater" &&
        item.status === "partial" &&
        String(item.groundedBasis).includes("Aqueduct 4.0"),
    ),
    "data-quality API exposes partial freshwater readiness grounded in Aqueduct 4.0",
  );
  assert(
    dataQuality.freshwaterStress?.sourceId === "wri-aqueduct-40-water-stress-v1" &&
      dataQuality.freshwaterStress?.license === "attribution",
    "data-quality API exposes the WRI Aqueduct freshwater artifact summary",
  );
  assert(
    dataQuality.sourceRegistry?.rows?.some(
      (row) =>
        row.sourceId === "unep-egr-2025-current-policies" &&
        row.displayPolicy === "show-as-policy-context-no-local-correction",
    ),
    "data-quality API exposes UNEP current-policy source row",
  );
  assert(
    dataQuality.sourceRegistry?.rows?.some(
      (row) =>
        row.sourceId === "cat-2025-warming-projections" &&
        row.displayPolicy === "show-as-policy-context-no-local-correction",
    ),
    "data-quality API exposes CAT warming-projection source row",
  );
  assert(
    dataQuality.sourceRegistry?.rows?.some(
      (row) =>
        row.sourceId === "natural-earth-populated-places-110m-v5" &&
        row.displayPolicy === "show-with-bounded-catalog-caveat",
    ),
    "data-quality API exposes Natural Earth population-place row",
  );
  assert(
    dataQuality.sourceRegistry?.rows?.some(
      (row) =>
        row.sourceId === "natural-earth-coastline-110m-v5" &&
        row.displayPolicy === "show-with-coastal-proximity-caveat",
    ),
    "data-quality API exposes Natural Earth coastline row",
  );
  assert(
    dataQuality.sourceRegistry?.rows?.some(
      (row) =>
        row.sourceId === "natural-earth-country-population-weighted-v1" &&
        row.displayPolicy === "show-with-country-aggregate-caveat",
    ),
    "data-quality API exposes Natural Earth country aggregate row",
  );
  assert(dataQuality.rankings?.catalogCount >= 3, "data-quality API exposes three ranking catalogs");
  assert(
    dataQuality.rankings?.catalogs?.some(
      (catalog) => catalog.catalog === "natural_earth_populated_places_110m" && catalog.catalogSize >= 50,
    ),
    "data-quality API exposes Natural Earth ranking catalog coverage",
  );
  assert(
    dataQuality.rankings?.catalogs?.some(
      (catalog) => catalog.catalog === "natural_earth_country_population_place_weighted" && catalog.catalogSize >= 25,
    ),
    "data-quality API exposes country aggregate ranking catalog coverage",
  );
  assert(dataQuality.coastalProximity?.catalog === "natural_earth_coastline_110m", "data-quality API exposes coastline proximity artifact");
  assert(dataQuality.coastalProximity?.thresholdsKm?.coastal === 50, "data-quality API exposes coastline proximity thresholds");
  assert(dataQuality.defaultScenarioPolicy?.scenario === "ssp245", "data-quality API exposes default scenario policy scenario");
  assert(
    Array.isArray(dataQuality.defaultScenarioPolicy?.sourceIds) &&
      dataQuality.defaultScenarioPolicy.sourceIds.includes("unep-egr-2025-current-policies") &&
      dataQuality.defaultScenarioPolicy.sourceIds.includes("cat-2025-warming-projections"),
    "data-quality API exposes default scenario policy source IDs",
  );
  assert(dataQuality.trajectoryAudit?.resultCount === 52, "data-quality API exposes trajectory audit matrix");
  assert(dataQuality.trajectoryAudit?.trendReviewCount > 0, "data-quality API exposes trend-review flags");
  assert(String(dataQuality.limitations ?? "").includes("Replit deployment"), "data-quality API discloses live-deploy limitation");
  assert(String(dataQuality.limitations ?? "").includes("Natural Earth 1:110m nearest-coast screen"), "data-quality API discloses coastal-proximity limitation");

  const robots = await getText("/robots.txt");
  assert(robots.res.status === 200, "GET /robots.txt returns 200");
  assert(robots.text.includes("Sitemap: https://fupit.com/sitemap.xml"), "robots.txt points at fupit.com sitemap");

  const sitemap = await getText("/sitemap.xml");
  assert(sitemap.res.status === 200, "GET /sitemap.xml returns 200");
  assert(sitemap.text.includes("https://fupit.com/methodology"), "sitemap includes /methodology");
  assert(sitemap.text.includes("https://fupit.com/rankings"), "sitemap includes /rankings");
  assert(sitemap.text.includes("https://fupit.com/data-quality"), "sitemap includes /data-quality");

  const legacyProjection = await getText("/api/projections?locationId=1&year=2050");
  assert(legacyProjection.res.status === 410, "legacy /api/projections returns 410");
  const legacyComparison = await getText("/api/climate/multi-comparison?locationIds=1&year=2050");
  assert(legacyComparison.res.status === 410, "legacy /api/climate/multi-comparison returns 410");
  const legacyCsv = await getText("/api/export/csv/1/2050");
  assert(legacyCsv.res.status === 410, "legacy /api/export/csv returns 410");
  const legacyKeys = await getText("/api/user/keys");
  assert(legacyKeys.res.status === 410, "legacy /api/user/keys returns 410");

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

    const { json: twinPayload } = await getJson(`/api/climate-twin?lat=${lat}&lng=${lng}&year=${year}&scenario=${scenario}&limit=3`);
    const twin = twinPayload.data;
    assert(twinPayload.success === true, "climate twin success=true");
    assert(twin?.target?.scenario === scenario, `climate twin target scenario=${scenario}`);
    assert(twin?.catalog?.id === "current", "climate twin uses current catalog");
    assert(Number.isInteger(twin?.catalog?.candidateCount) && twin.catalog.candidateCount > 0, "climate twin reports bounded catalog size");
    assert(Number.isInteger(twin?.catalog?.comparedCount) && twin.catalog.comparedCount > 0, "climate twin reports compared count");
    assert(typeof twin?.match?.candidate?.name === "string", "climate twin has closest match name");
    assert(Number.isFinite(twin?.match?.distance), "climate twin match distance is finite");
    assert(Number.isFinite(twin?.match?.distanceComponents?.monthlyTemperature), "climate twin temperature distance is finite");
    assert(Number.isFinite(twin?.match?.distanceComponents?.monthlyPrecipitation), "climate twin precipitation distance is finite");
    assert(Array.isArray(twin?.sourceReceipt?.sourceIds) && twin.sourceReceipt.sourceIds.includes("curated-ranking-cities-v1"), "climate twin source receipt includes catalog source");
    assert(Array.isArray(twin?.sourceReceipt?.caveats) && twin.sourceReceipt.caveats.some((caveat) => caveat.includes("bounded")), "climate twin exposes bounded-catalog caveat");
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
