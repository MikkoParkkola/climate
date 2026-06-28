#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const versionsSource = readFileSync(path.join(repoRoot, "server", "model-cache-version.ts"), "utf8");
const modelVersion = versionsSource.match(/MODEL_CACHE_VERSION\s*=\s*"([^"]+)"/)?.[1];
const sourceRegistryVersion = versionsSource.match(/SOURCE_REGISTRY_VERSION\s*=\s*"([^"]+)"/)?.[1];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function sha256(relativePath) {
  return createHash("sha256").update(readFileSync(path.join(repoRoot, relativePath))).digest("hex");
}

for (const relativePath of [
  "data/grid.i16.gz",
  "data/worldclim10m.i16.gz",
  "data/manifest.json",
  "data/worldclim10m.manifest.json",
  "data/source-registry.json",
  "data/population-centers.natural-earth-110m.json",
  "data/rankings.curated-cities.json",
  "data/rankings.natural-earth-populated-places.json",
  "data/rankings.natural-earth-country-population-weighted.json",
  "data/trajectory-audit-summary.json",
  "data/observed-baseline-audit.json",
  "docs/VALIDATION_REPORT.md",
  "client/public/climate-analog-catalog.current.json",
]) {
  assert(existsSync(path.join(repoRoot, relativePath)), `${relativePath} missing`);
  assert(statSync(path.join(repoRoot, relativePath)).size > 0, `${relativePath} is empty`);
}

const registry = readJson("data/source-registry.json");
assert(registry.version === sourceRegistryVersion, "source registry version mismatch");
assert(Array.isArray(registry.rows) && registry.rows.length >= 10, "source registry rows incomplete");
const sourceIds = new Set(registry.rows.map((row) => row.sourceId));
assert(sourceIds.has("ipcc-ar6-amoc"), "AMOC/Gulf Stream context source row missing");
assert(sourceIds.has("natural-earth-populated-places-110m-v5"), "Natural Earth population-place source row missing");
assert(sourceIds.has("natural-earth-country-population-weighted-v1"), "Natural Earth country aggregate source row missing");
const requireRegisteredSources = (ids, context) => {
  assert(Array.isArray(ids) && ids.length > 0, `${context} source ids missing`);
  for (const sourceId of ids) {
    assert(sourceIds.has(sourceId), `${context} uses unregistered source id ${sourceId}`);
  }
};
const getSourceRow = (sourceId) => registry.rows.find((row) => row.sourceId === sourceId);

const manifest = readJson("data/manifest.json");
assert(manifest.methodVersion === modelVersion, "grid manifest method version mismatch");
assert(manifest.cacheVersion === modelVersion, "grid manifest cache version mismatch");
assert(manifest.sourceRegistryVersion === sourceRegistryVersion, "grid manifest source registry version mismatch");
assert(manifest.defaultScenario === "ssp245", "grid manifest default scenario mismatch");
assert(manifest.defaultScenarioPolicyVersion === "current-policy-reference-2025", "grid manifest default scenario policy version missing");
assert(
  typeof manifest.defaultScenarioPolicyBasis === "string" &&
    manifest.defaultScenarioPolicyBasis.includes("UNEP current-policy") &&
    manifest.defaultScenarioPolicyBasis.includes("Climate Action Tracker") &&
    manifest.defaultScenarioPolicyBasis.includes("not a prediction or hidden scenario average"),
  "grid manifest default scenario policy basis incomplete",
);
assert(
  JSON.stringify(manifest.defaultScenarioPolicySourceIds) ===
    JSON.stringify(["unep-egr-2025-current-policies", "cat-2025-warming-projections"]),
  "grid manifest default scenario policy source ids mismatch",
);
requireRegisteredSources(manifest.defaultScenarioPolicySourceIds, "default scenario policy");
for (const sourceId of manifest.defaultScenarioPolicySourceIds) {
  assert(
    getSourceRow(sourceId)?.displayPolicy === "show-as-policy-context-no-local-correction",
    `default scenario policy source ${sourceId} must be policy context only`,
  );
}
assert(
  JSON.stringify(manifest.supportedFullForecastScenarios) === JSON.stringify(["ssp126", "ssp245", "ssp370", "ssp585"]),
  "grid manifest supported full-forecast scenarios mismatch",
);
assert(
  manifest.artifactHashes?.["grid.i16.gz"] === `sha256:${sha256("data/grid.i16.gz")}`,
  "grid artifact hash mismatch",
);

const populatedPlaces = readJson("data/population-centers.natural-earth-110m.json");
assert(populatedPlaces.catalog === "natural_earth_populated_places_110m", "Natural Earth catalog id mismatch");
assert(populatedPlaces.sourceId === "natural-earth-populated-places-110m-v5", "Natural Earth catalog source id mismatch");
assert(populatedPlaces.populationThreshold === 3000000, "Natural Earth population threshold mismatch");
assert(Array.isArray(populatedPlaces.places) && populatedPlaces.places.length >= 50, "Natural Earth places missing");
for (const place of populatedPlaces.places) {
  assert(Number.isFinite(place.lat) && Number.isFinite(place.lng), "Natural Earth place coordinates invalid");
  assert(Number.isFinite(place.population) && place.population >= populatedPlaces.populationThreshold, "Natural Earth place population invalid");
}

const rankingArtifacts = [
  readJson("data/rankings.curated-cities.json"),
  readJson("data/rankings.natural-earth-populated-places.json"),
  readJson("data/rankings.natural-earth-country-population-weighted.json"),
];
const rankingCatalogs = new Set(rankingArtifacts.map((artifact) => artifact.catalog));
assert(rankingCatalogs.has("curated_cities"), "curated ranking catalog missing");
assert(rankingCatalogs.has("natural_earth_populated_places_110m"), "Natural Earth ranking catalog missing");
assert(rankingCatalogs.has("natural_earth_country_population_place_weighted"), "Natural Earth country aggregate ranking catalog missing");

let rankingEntryCount = 0;
for (const rankings of rankingArtifacts) {
  assert(rankings.methodVersion === modelVersion, "ranking method version mismatch");
  assert(rankings.sourceRegistryVersion === sourceRegistryVersion, "ranking source registry version mismatch");
  assert(Array.isArray(rankings.entries) && rankings.entries.length > 0, "ranking entries missing");
  rankingEntryCount += rankings.entries.length;

  for (const entry of rankings.entries) {
    assert(entry.methodVersion === modelVersion, "ranking entry method version mismatch");
    assert(entry.sourceRegistryVersion === sourceRegistryVersion, "ranking entry source registry mismatch");
    assert(entry.catalog === rankings.catalog, "ranking catalog mismatch");
    assert(["highest", "lowest"].includes(entry.direction), "ranking direction invalid");
    assert(Array.isArray(entry.rows) && entry.rows.length > 0, "ranking rows missing");
    requireRegisteredSources(entry.sourceIds, "ranking");
    if (entry.catalog === "natural_earth_country_population_place_weighted") {
      assert(entry.placeSampleSize >= 50, "country aggregate place sample size missing");
      assert(entry.caveats.some((caveat) => caveat.includes("not a complete national exposure")), "country aggregate caveat missing");
      assert(entry.rows.every((row) => row.country === "country aggregate"), "country aggregate rows must be labelled");
      assert(entry.rows.every((row) => Number.isFinite(row.placeCount) && row.placeCount >= 1), "country aggregate place counts missing");
      assert(entry.rows.every((row) => Array.isArray(row.includedPlaces) && row.includedPlaces.length === row.placeCount), "country aggregate included place lists missing");
    }
  }
}

const analog = readJson("client/public/climate-analog-catalog.current.json");
const analogSourceIds = [
  "worldclim-v2-1",
  "cmip6-scenariomip",
  "ipcc-ar6-temperature",
  "cmip6-etccdi",
  "curated-ranking-cities-v1",
];
assert(analog.version === "grounded-current-analogs-v1", "analog catalog version mismatch");
assert(analog.catalogYear === new Date().getFullYear(), "analog catalog is not generated for the current year");
assert(analog.scenario === "ssp245", "analog catalog scenario mismatch");
assert(Array.isArray(analog.candidates) && analog.candidates.length === analog.candidateCount, "analog catalog candidate count mismatch");
assert(analog.candidateCount === 45, "analog catalog curated candidate count mismatch");
requireRegisteredSources(analogSourceIds, "climate analog catalog");
for (const candidate of analog.candidates) {
  assert(candidate.year === analog.catalogYear, "analog candidate year mismatch");
  assert(candidate.scenario === analog.scenario, "analog candidate scenario mismatch");
  assert(Array.isArray(candidate.temperature?.monthly) && candidate.temperature.monthly.length === 12, "analog monthly temperatures invalid");
  assert(Array.isArray(candidate.precipitation?.monthly) && candidate.precipitation.monthly.length === 12, "analog monthly precipitation invalid");
  assert(Number.isFinite(candidate.temperature.annual_mean), "analog annual temperature invalid");
  assert(Number.isFinite(candidate.precipitation.annual_total), "analog annual precipitation invalid");
  assert(Number.isFinite(candidate.extremes?.heat_stress_days), "analog heat-stress days invalid");
  assert(Number.isFinite(candidate.extremes?.drought_risk), "analog drought risk invalid");
  assert(Number.isFinite(candidate.extremes?.flood_risk), "analog flood risk invalid");
}

const audit = readJson("data/trajectory-audit-summary.json");
assert(audit.version === "trajectory-audit-summary-v1", "trajectory audit summary version mismatch");
assert(audit.cityCount === 13, "trajectory audit city count mismatch");
assert(audit.resultCount === 52, "trajectory audit result count mismatch");
assert(Array.isArray(audit.trendReview), "trajectory audit trend review missing");
const observedBaselineAudit = readJson("data/observed-baseline-audit.json");
assert(observedBaselineAudit.version === "observed-baseline-audit-v1", "observed baseline audit version mismatch");
assert(observedBaselineAudit.cityCount === 13, "observed baseline audit city count mismatch");
assert(observedBaselineAudit.maxTemperatureDifferenceC <= 0.02, "observed baseline audit temperature mismatch too large");
assert(observedBaselineAudit.maxPrecipitationDifferenceMm <= 0.05, "observed baseline audit precipitation mismatch too large");
assert(
  observedBaselineAudit.results.every((result) => result.projectionYearBasis?.source_year_low === 2030 && result.projectionYearBasis?.mode === "clamped-earliest-source-year"),
  "observed baseline audit does not disclose pre-2030 source-year basis",
);
const validationReport = readFileSync(path.join(repoRoot, "docs/VALIDATION_REPORT.md"), "utf8");
const scientificGrounding = readFileSync(path.join(repoRoot, "docs/architecture/SCIENTIFIC_GROUNDING.md"), "utf8");
assert(validationReport.includes(audit.generatedAt), "validation report is not synced to trajectory audit artifact");
assert(validationReport.includes("Not a Historical Hindcast"), "validation report must disclose missing historical hindcast");
assert(validationReport.includes(observedBaselineAudit.generatedAt), "validation report is not synced to observed baseline audit artifact");
assert(validationReport.includes("Trend review flags are unresolved scientific-review evidence"), "validation report must keep trend flags visible");
assert(scientificGrounding.includes("packed 2030 scenario layer"), "scientific grounding must disclose near-current source-year basis");

console.log(`artifact validation passed: ${rankingEntryCount} ranking slices, ${analog.candidateCount} analog candidates, ${registry.rows.length} source rows, ${audit.resultCount} audit results, ${observedBaselineAudit.cityCount} baseline checks`);
