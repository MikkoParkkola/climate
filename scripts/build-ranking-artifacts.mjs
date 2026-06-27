#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pythonBin = process.env.PYTHON_BIN || "python3";
const modelPath = path.join(repoRoot, "grounded_model.py");
const modelVersion = readFileSync(path.join(repoRoot, "server", "model-cache-version.ts"), "utf8")
  .match(/MODEL_CACHE_VERSION\s*=\s*"([^"]+)"/)?.[1];
const sourceRegistryVersion = readFileSync(path.join(repoRoot, "server", "model-cache-version.ts"), "utf8")
  .match(/SOURCE_REGISTRY_VERSION\s*=\s*"([^"]+)"/)?.[1];

if (!modelVersion || !sourceRegistryVersion) {
  throw new Error("Could not read model/source registry versions");
}

const scenarios = ["ssp119", "ssp126", "ssp245", "ssp370", "ssp585"];
const years = [2025, 2026, ...Array.from({ length: 15 }, (_, i) => 2030 + i * 5)];
const catalog = "curated_cities";
const commonSourceIds = ["curated-ranking-cities-v1"];
const metricSpecs = [
  {
    metric: "habitability_score",
    label: "Habitability score",
    unit: "score",
    sourceIds: [...commonSourceIds, "derived-habitability-v2", "worldclim-v2-1", "cmip6-scenariomip", "cmip6-etccdi"],
    value: (row) => row.habitability?.score,
    uncertainty: () => ({}),
  },
  {
    metric: "heat_stress_days",
    label: "Heat-stress nights",
    unit: "nights/year",
    sourceIds: [...commonSourceIds, "cmip6-etccdi", "worldclim-v2-1"],
    value: (row) => row.extremes?.heat_stress_days,
    uncertainty: () => ({}),
  },
  {
    metric: "drought_risk",
    label: "Drought pressure",
    unit: "0-100 score",
    sourceIds: [...commonSourceIds, "cmip6-etccdi", "worldclim-v2-1"],
    value: (row) => row.extremes?.drought_risk,
    uncertainty: () => ({}),
  },
  {
    metric: "flood_risk",
    label: "Heavy-rain flood pressure",
    unit: "0-100 score",
    sourceIds: [...commonSourceIds, "cmip6-etccdi", "worldclim-v2-1"],
    value: (row) => row.extremes?.flood_risk,
    uncertainty: () => ({}),
  },
  {
    metric: "warming_anomaly_c",
    label: "Temperature anomaly",
    unit: "degC",
    sourceIds: [...commonSourceIds, "cmip6-scenariomip", "worldclim-v2-1"],
    value: (row) => row.temperature?.anomaly,
    uncertainty: (row) => {
      const spread = row.temperature?.uncertainty?.anomaly_spread;
      const value = row.temperature?.anomaly;
      return Number.isFinite(value) && Number.isFinite(spread)
        ? { low: Number((value - spread).toFixed(2)), high: Number((value + spread).toFixed(2)) }
        : {};
    },
  },
  {
    metric: "sea_level_rise_cm",
    label: "Regional sea-level rise",
    unit: "cm",
    sourceIds: [...commonSourceIds, "ipcc-ar6-sealevel"],
    value: (row) => row.extremes?.sea_level_rise_cm,
    uncertainty: (row) => {
      const detail = row.extremes?.detail?.uncertainty;
      return { low: detail?.sea_level_low_cm ?? null, high: detail?.sea_level_high_cm ?? null };
    },
  },
];

function runRankings(year, scenario) {
  const result = spawnSync(pythonBin, [modelPath, "--rankings", String(year), scenario], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`grounded_model.py --rankings failed for ${year}/${scenario}: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout).rankings;
}

function rowId(row) {
  return `${row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${row.country.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function buildRows(rows, spec, direction) {
  const ranked = rows
    .map((row) => {
      const value = spec.value(row);
      return {
        rank: 0,
        id: rowId(row),
        name: row.name,
        country: row.country,
        lat: row.lat,
        lng: row.lng,
        value,
        unit: spec.unit,
        uncertainty: spec.uncertainty(row),
        sourceReceipt: spec.sourceIds,
      };
    })
    .filter((row) => Number.isFinite(row.value))
    .sort((a, b) => direction === "highest" ? b.value - a.value : a.value - b.value)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  return ranked;
}

const entries = [];
for (const scenario of scenarios) {
  for (const year of years) {
    const rows = runRankings(year, scenario);
    for (const spec of metricSpecs) {
      for (const direction of ["highest", "lowest"]) {
        const rankedRows = buildRows(rows, spec, direction);
        if (rankedRows.length === 0) {
          continue;
        }
        entries.push({
          methodVersion: modelVersion,
          sourceRegistryVersion,
          catalog,
          catalogSize: rows.length,
          scenario,
          year,
          metric: spec.metric,
          label: spec.label,
          direction,
          unit: spec.unit,
          rows: rankedRows,
          exclusions: rows.length === 0 ? ["No catalog rows available"] : [],
          caveats: [
            "Curated-city rankings are bounded examples, not complete global rankings.",
            "Ranks omit adaptation capacity, governance, health systems, wealth, migration, conflict, and local infrastructure.",
            "Do not interpret a high rank as a safe city or climate haven claim.",
          ],
          sourceIds: spec.sourceIds,
        });
      }
    }
  }
}

const artifact = {
  methodVersion: modelVersion,
  sourceRegistryVersion,
  generatedAt: new Date().toISOString(),
  catalog,
  entries,
};

const outPath = path.join(repoRoot, "data", "rankings.curated-cities.json");
writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(`wrote ${path.relative(repoRoot, outPath)} with ${entries.length} ranking slices`);
