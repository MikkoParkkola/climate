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
]) {
  assert(existsSync(path.join(repoRoot, relativePath)), `${relativePath} missing`);
  assert(statSync(path.join(repoRoot, relativePath)).size > 0, `${relativePath} is empty`);
}

const registry = readJson("data/source-registry.json");
assert(registry.version === sourceRegistryVersion, "source registry version mismatch");
assert(Array.isArray(registry.rows) && registry.rows.length >= 6, "source registry rows incomplete");
const sourceIds = new Set(registry.rows.map((row) => row.sourceId));

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
  assert(Array.isArray(entry.sourceIds) && entry.sourceIds.length > 0, "ranking source ids missing");
  for (const sourceId of entry.sourceIds) {
    assert(sourceIds.has(sourceId), `ranking uses unregistered source id ${sourceId}`);
  }
}

console.log(`artifact validation passed: ${rankings.entries.length} ranking slices, ${registry.rows.length} source rows`);
