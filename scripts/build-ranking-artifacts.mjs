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

const scenarios = ["ssp126", "ssp245", "ssp370", "ssp585"];
const years = [2025, 2026, ...Array.from({ length: 15 }, (_, i) => 2030 + i * 5)];
const catalogSpecs = [
  {
    catalog: "curated_cities",
    label: "Curated city examples",
    file: "ranking_cities.json",
    output: "rankings.curated-cities.json",
    sourceIds: ["curated-ranking-cities-v1"],
    caveats: [
      "Curated-city rankings are bounded examples, not complete global rankings.",
      "Ranks omit adaptation capacity, governance, health systems, wealth, migration, conflict, and local infrastructure.",
      "Do not interpret a high rank as a safe city or climate haven claim.",
    ],
  },
  {
    catalog: "natural_earth_populated_places_110m",
    label: "Natural Earth populated places, pop_max >= 3 million",
    file: "population-centers.natural-earth-110m.json",
    output: "rankings.natural-earth-populated-places.json",
    sourceIds: ["natural-earth-populated-places-110m-v5"],
    caveats: [
      "Natural Earth populated-place rankings are bounded to 1:110m point features with pop_max >= 3,000,000, not a complete GHSL urban-center inventory.",
      "Population values are catalog attributes used for inclusion, not population-weighted climate exposure.",
      "Ranks omit adaptation capacity, governance, health systems, wealth, migration, conflict, and local infrastructure.",
      "Do not interpret a high rank as a safe city, climate haven, or complete global winner/loser claim.",
    ],
  },
];
const countryAggregateSpec = {
  catalog: "natural_earth_country_population_place_weighted",
  label: "Country aggregates, Natural Earth populated places weighted by pop_max",
  output: "rankings.natural-earth-country-population-weighted.json",
  sourceIds: ["natural-earth-country-population-weighted-v1", "natural-earth-populated-places-110m-v5"],
  caveats: [
    "Country aggregates are population-place weighted across Natural Earth 1:110m point features with pop_max >= 3,000,000.",
    "This is not a complete national exposure, rural exposure, area-average, or GHSL population-weighted country ranking.",
    "Countries without an included Natural Earth populated place are excluded from this bounded artifact.",
    "Ranks omit adaptation capacity, governance, health systems, wealth, migration, conflict, and local infrastructure.",
    "Do not interpret a high rank as a safe country, climate haven, or complete global winner/loser claim.",
  ],
};
const metricSpecs = [
  {
    metric: "habitability_score",
    label: "Habitability score",
    unit: "score",
    sourceIds: ["derived-habitability-v2", "worldclim-v2-1", "cmip6-scenariomip", "cmip6-etccdi"],
    value: (row) => row.habitability?.score,
    uncertainty: () => ({}),
  },
  {
    metric: "heat_stress_days",
    label: "Heat-stress nights",
    unit: "nights/year",
    sourceIds: ["cmip6-etccdi", "worldclim-v2-1"],
    value: (row) => row.extremes?.heat_stress_days,
    uncertainty: () => ({}),
  },
  {
    metric: "drought_risk",
    label: "Drought pressure",
    unit: "0-100 score",
    sourceIds: ["cmip6-etccdi", "worldclim-v2-1"],
    value: (row) => row.extremes?.drought_risk,
    uncertainty: () => ({}),
  },
  {
    metric: "flood_risk",
    label: "Heavy-rain flood pressure",
    unit: "0-100 score",
    sourceIds: ["cmip6-etccdi", "worldclim-v2-1"],
    value: (row) => row.extremes?.flood_risk,
    uncertainty: () => ({}),
  },
  {
    metric: "warming_anomaly_c",
    label: "Temperature anomaly",
    unit: "degC",
    sourceIds: ["cmip6-scenariomip", "worldclim-v2-1"],
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
    sourceIds: ["ipcc-ar6-sealevel"],
    value: (row) => row.extremes?.sea_level_rise_cm,
    uncertainty: (row) => {
      const detail = row.extremes?.detail?.uncertainty;
      return { low: detail?.sea_level_low_cm ?? null, high: detail?.sea_level_high_cm ?? null };
    },
  },
];

function runRankings(year, scenario, catalogSpec) {
  const result = spawnSync(pythonBin, [modelPath, "--rankings", String(year), scenario, catalogSpec.file], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`grounded_model.py --rankings failed for ${catalogSpec.catalog}/${year}/${scenario}: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout).rankings;
}

function rowId(row) {
  return `${row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${row.country.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function weightedMean(values) {
  let weighted = 0;
  let total = 0;
  for (const { value, weight } of values) {
    if (!Number.isFinite(value) || !Number.isFinite(weight) || weight <= 0) continue;
    weighted += value * weight;
    total += weight;
  }
  return total > 0 ? weighted / total : null;
}

function buildCountryRows(rows, spec) {
  const groups = new Map();
  for (const row of rows) {
    const value = spec.value(row);
    if (!Number.isFinite(value) || !row.country) continue;
    const weight = Number.isFinite(row.population) && row.population > 0 ? row.population : 1;
    const uncertainty = spec.uncertainty(row);
    const current = groups.get(row.country) ?? {
      country: row.country,
      values: [],
      lows: [],
      highs: [],
      lats: [],
      lngs: [],
      population: 0,
      places: [],
    };
    current.values.push({ value, weight });
    if (Number.isFinite(uncertainty?.low)) current.lows.push({ value: uncertainty.low, weight });
    if (Number.isFinite(uncertainty?.high)) current.highs.push({ value: uncertainty.high, weight });
    current.lats.push({ value: row.lat, weight });
    current.lngs.push({ value: row.lng, weight });
    current.population += weight;
    current.places.push(row.name);
    groups.set(row.country, current);
  }

  return Array.from(groups.values())
    .map((group) => {
      const value = weightedMean(group.values);
      if (!Number.isFinite(value)) return null;
      const low = weightedMean(group.lows);
      const high = weightedMean(group.highs);
      return {
        name: group.country,
        country: "country aggregate",
        lat: weightedMean(group.lats) ?? 0,
        lng: weightedMean(group.lngs) ?? 0,
        population: group.population,
        populationField: "pop_max weighted included places",
        placeCount: group.places.length,
        includedPlaces: group.places.sort((a, b) => a.localeCompare(b)),
        inclusionReason: `Population-place weighted aggregate from ${group.places.length} Natural Earth populated place${group.places.length === 1 ? "" : "s"} with pop_max >= 3000000.`,
        value,
        uncertainty: Number.isFinite(low) && Number.isFinite(high)
          ? { low: Number(low.toFixed(2)), high: Number(high.toFixed(2)) }
          : {},
      };
    })
    .filter(Boolean);
}

function buildRows(rows, spec, direction, catalogSpec) {
  const ranked = rows
    .map((row) => {
      const value = Number.isFinite(row.value) ? row.value : spec.value(row);
      return {
        rank: 0,
        id: rowId(row),
        name: row.name,
        country: row.country,
        lat: row.lat,
        lng: row.lng,
        population: row.population,
        populationField: row.populationField,
        placeCount: row.placeCount,
        includedPlaces: row.includedPlaces,
        inclusionReason: row.inclusionReason,
        value,
        unit: spec.unit,
        uncertainty: row.uncertainty ?? spec.uncertainty(row),
        sourceReceipt: [...catalogSpec.sourceIds, ...spec.sourceIds],
      };
    })
    .filter((row) => Number.isFinite(row.value))
    .sort((a, b) => direction === "highest" ? b.value - a.value : a.value - b.value)
    .slice(0, 10)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  return ranked;
}

function buildRankingEntriesForRows(rows, catalogSpec) {
  const entries = [];
  for (const spec of metricSpecs) {
    for (const direction of ["highest", "lowest"]) {
      const rankedRows = buildRows(rows, spec, direction, catalogSpec);
      if (rankedRows.length === 0) continue;
      const sourceIds = [...catalogSpec.sourceIds, ...spec.sourceIds];
      entries.push({ spec, direction, rankedRows, sourceIds });
    }
  }
  return entries;
}

const countryEntries = [];
let countryCatalogSize = 0;

for (const catalogSpec of catalogSpecs) {
  const entries = [];
  for (const scenario of scenarios) {
    for (const year of years) {
      const rows = runRankings(year, scenario, catalogSpec);
      for (const { spec, direction, rankedRows, sourceIds } of buildRankingEntriesForRows(rows, catalogSpec)) {
        entries.push({
          methodVersion: modelVersion,
          sourceRegistryVersion,
          catalog: catalogSpec.catalog,
          catalogLabel: catalogSpec.label,
          catalogSize: rows.length,
          scenario,
          year,
          metric: spec.metric,
          label: spec.label,
          direction,
          unit: spec.unit,
          rows: rankedRows,
          exclusions: rows.length === 0 ? ["No catalog rows available"] : [],
          caveats: catalogSpec.caveats,
          sourceIds,
        });
      }

      if (catalogSpec.catalog === "natural_earth_populated_places_110m") {
        const countryRowsByMetric = new Map(metricSpecs.map((spec) => [spec.metric, buildCountryRows(rows, spec)]));
        countryCatalogSize = Math.max(countryCatalogSize, countryRowsByMetric.get(metricSpecs[0].metric)?.length ?? 0);
        for (const spec of metricSpecs) {
          const countryRows = countryRowsByMetric.get(spec.metric) ?? [];
          for (const { direction, rankedRows, sourceIds } of buildRankingEntriesForRows(countryRows, countryAggregateSpec).filter((entry) => entry.spec.metric === spec.metric)) {
            countryEntries.push({
              methodVersion: modelVersion,
              sourceRegistryVersion,
              catalog: countryAggregateSpec.catalog,
              catalogLabel: countryAggregateSpec.label,
              catalogSize: countryRows.length,
              placeSampleSize: rows.length,
              scenario,
              year,
              metric: spec.metric,
              label: spec.label,
              direction,
              unit: spec.unit,
              rows: rankedRows,
              exclusions: countryRows.length === 0 ? ["No country aggregates available"] : [],
              caveats: countryAggregateSpec.caveats,
              sourceIds,
            });
          }
        }
      }
    }
  }

  const artifact = {
    methodVersion: modelVersion,
    sourceRegistryVersion,
    generatedAt: new Date().toISOString(),
    catalog: catalogSpec.catalog,
    catalogLabel: catalogSpec.label,
    catalogSourceIds: catalogSpec.sourceIds,
    entries,
  };

  const outPath = path.join(repoRoot, "data", catalogSpec.output);
  writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`wrote ${path.relative(repoRoot, outPath)} with ${entries.length} ranking slices`);
}

const countryArtifact = {
  methodVersion: modelVersion,
  sourceRegistryVersion,
  generatedAt: new Date().toISOString(),
  catalog: countryAggregateSpec.catalog,
  catalogLabel: countryAggregateSpec.label,
  catalogSourceIds: countryAggregateSpec.sourceIds,
  countryCount: countryCatalogSize,
  entries: countryEntries,
};

const countryOutPath = path.join(repoRoot, "data", countryAggregateSpec.output);
writeFileSync(countryOutPath, `${JSON.stringify(countryArtifact, null, 2)}\n`);
console.log(`wrote ${path.relative(repoRoot, countryOutPath)} with ${countryEntries.length} ranking slices`);
