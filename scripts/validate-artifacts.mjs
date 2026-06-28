#!/usr/bin/env node
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

for (const relativePath of [
  "data/grid.i16.gz",
  "data/worldclim10m.i16.gz",
  "data/manifest.json",
  "data/worldclim10m.manifest.json",
  "data/source-registry.json",
  "data/rankings.curated-cities.json",
  "data/trajectory-audit-summary.json",
  "docs/VALIDATION_REPORT.md",
  "client/public/climate-analog-catalog.current.json",
]) {
  assert(existsSync(path.join(repoRoot, relativePath)), `${relativePath} missing`);
  assert(statSync(path.join(repoRoot, relativePath)).size > 0, `${relativePath} is empty`);
}

const registry = readJson("data/source-registry.json");
assert(registry.version === sourceRegistryVersion, "source registry version mismatch");
assert(Array.isArray(registry.rows) && registry.rows.length >= 6, "source registry rows incomplete");
const sourceIds = new Set(registry.rows.map((row) => row.sourceId));
assert(sourceIds.has("ipcc-ar6-amoc"), "AMOC/Gulf Stream context source row missing");
const requireRegisteredSources = (ids, context) => {
  assert(Array.isArray(ids) && ids.length > 0, `${context} source ids missing`);
  for (const sourceId of ids) {
    assert(sourceIds.has(sourceId), `${context} uses unregistered source id ${sourceId}`);
  }
};

const rankings = readJson("data/rankings.curated-cities.json");
assert(rankings.methodVersion === modelVersion, "ranking method version mismatch");
assert(rankings.sourceRegistryVersion === sourceRegistryVersion, "ranking source registry version mismatch");
assert(Array.isArray(rankings.entries) && rankings.entries.length > 0, "ranking entries missing");

for (const entry of rankings.entries) {
  assert(entry.methodVersion === modelVersion, "ranking entry method version mismatch");
  assert(entry.sourceRegistryVersion === sourceRegistryVersion, "ranking entry source registry mismatch");
  assert(entry.catalog === "curated_cities", "ranking catalog mismatch");
  assert(["highest", "lowest"].includes(entry.direction), "ranking direction invalid");
  assert(Array.isArray(entry.rows) && entry.rows.length > 0, "ranking rows missing");
  requireRegisteredSources(entry.sourceIds, "ranking");
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
const validationReport = readFileSync(path.join(repoRoot, "docs/VALIDATION_REPORT.md"), "utf8");
assert(validationReport.includes(audit.generatedAt), "validation report is not synced to trajectory audit artifact");
assert(validationReport.includes("Not a Historical Hindcast"), "validation report must disclose missing historical hindcast");
assert(validationReport.includes("Trend review flags are unresolved scientific-review evidence"), "validation report must keep trend flags visible");

console.log(`artifact validation passed: ${rankings.entries.length} ranking slices, ${analog.candidateCount} analog candidates, ${registry.rows.length} source rows, ${audit.resultCount} audit results`);
