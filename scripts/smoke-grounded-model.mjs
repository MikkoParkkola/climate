#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modelPath = path.join(repoRoot, "grounded_model.py");
const gridPath = path.join(repoRoot, "data", "grid.i16.gz");
const manifestPath = path.join(repoRoot, "data", "manifest.json");
const worldclimPath = path.join(repoRoot, "data", "worldclim10m.i16.gz");
const worldclimManifestPath = path.join(repoRoot, "data", "worldclim10m.manifest.json");

const samples = [
  { name: "Helsinki", lat: 60.17, lng: 24.94 },
  { name: "Singapore", lat: 1.35, lng: 103.82 },
  { name: "Cairo", lat: 30.04, lng: 31.24 },
  { name: "Mumbai", lat: 19.08, lng: 72.88 },
  { name: "Manaus", lat: -3.12, lng: -60.02 },
];

const requiredPaths = [
  "location.latitude",
  "location.longitude",
  "location.name",
  "location.climate_zone",
  "year",
  "scenario",
  "temperature.annual_mean",
  "temperature.anomaly",
  "temperature.min",
  "temperature.max",
  "temperature.seasonal_amplitude",
  "temperature.uncertainty.annual_mean_low",
  "temperature.uncertainty.annual_mean_high",
  "temperature.uncertainty.anomaly_spread",
  "precipitation.annual_total",
  "precipitation.anomaly_percent",
  "precipitation.wettest_month",
  "precipitation.driest_month",
  "precipitation.wettest_month_name",
  "precipitation.driest_month_name",
  "precipitation.uncertainty.annual_total_low",
  "precipitation.uncertainty.annual_total_high",
  "precipitation.uncertainty.anomaly_percent_spread",
  "extremes.heat_stress_days",
  "extremes.drought_risk",
  "extremes.flood_risk",
  "extremes.sea_level_rise_cm",
  "extremes.detail.uncertainty.sea_level_low_cm",
  "extremes.detail.uncertainty.sea_level_high_cm",
  "habitability.score",
  "habitability.category",
  "habitability.breakdown.temperature_comfort",
  "habitability.breakdown.precipitation_adequacy",
  "habitability.breakdown.infrastructure_adaptation",
  "habitability.breakdown.heat_stress_penalty",
  "habitability.breakdown.drought_penalty",
  "habitability.breakdown.flood_penalty",
  "habitability.breakdown.base_score",
  "habitability.breakdown.final_score",
  "metadata.model",
  "metadata.model_version",
  "metadata.data_source",
  "metadata.baseline",
  "metadata.baseline_source.temperature",
  "metadata.baseline_source.precipitation",
  "metadata.baseline_source.delta_reference_period",
  "metadata.projection_method",
  "metadata.uncertainty.temperature_anomaly_spread_c",
  "metadata.uncertainty.precipitation_anomaly_spread_pct",
  "metadata.uncertainty.sea_level_low_cm",
  "metadata.uncertainty.sea_level_high_cm",
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getPath(value, dottedPath) {
  return dottedPath.split(".").reduce((current, key) => current?.[key], value);
}

function collectNullPaths(value, prefix = "$", out = []) {
  if (value === null) {
    out.push(prefix);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => collectNullPaths(item, `${prefix}[${index}]`, out));
  } else if (typeof value === "object" && value !== undefined) {
    for (const [key, nested] of Object.entries(value)) {
      collectNullPaths(nested, `${prefix}.${key}`, out);
    }
  }
  return out;
}

function runModel(pythonBin, sample, year = 2050, scenario = "ssp245") {
  const result = spawnSync(
    pythonBin,
    [modelPath, String(sample.lat), String(sample.lng), String(year), scenario],
    { cwd: repoRoot, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `${sample.name} model process failed with exit ${result.status}: ${result.stderr || result.stdout}`,
    );
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${sample.name} model output was not valid JSON: ${error.message}`);
  }
}

function runTrajectory(pythonBin, sample, years, scenario = "ssp245") {
  const result = spawnSync(
    pythonBin,
    [modelPath, "--trajectory", String(sample.lat), String(sample.lng), years.join(","), scenario],
    { cwd: repoRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `${sample.name} trajectory process failed with exit ${result.status}: ${result.stderr || result.stdout}`,
    );
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${sample.name} trajectory output was not valid JSON: ${error.message}`);
  }
}

function assertInvalidYearRejected(pythonBin) {
  const invalidYear = "2200";
  const commands = [
    {
      label: "single projection",
      args: [modelPath, "60.17", "24.94", invalidYear],
    },
    {
      label: "trajectory projection",
      args: [modelPath, "--trajectory", "60.17", "24.94", `2050,${invalidYear}`],
    },
    {
      label: "rankings projection",
      args: [modelPath, "--rankings", invalidYear],
    },
  ];

  for (const command of commands) {
    const result = spawnSync(pythonBin, command.args, {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
    });
    if (result.error) {
      throw result.error;
    }
    assert(result.status !== 0, `${command.label} accepted year ${invalidYear}`);
    assert(
      result.stderr.includes("2100"),
      `${command.label} rejection did not mention the 2100 upper bound: ${result.stderr || result.stdout}`,
    );
  }
}

function findPython() {
  const candidates = [process.env.PYTHON_BIN, "python3", "python"].filter(Boolean);
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["-c", "import numpy"], { encoding: "utf8" });
    if (result.status === 0) return candidate;
  }
  throw new Error("No python executable with numpy available. Install numpy or set PYTHON_BIN.");
}

function validateProjection(sample, projection, expectedYear = 2050, expectedScenario = "ssp245") {
  for (const requiredPath of requiredPaths) {
    assert(getPath(projection, requiredPath) !== undefined, `${sample.name} missing ${requiredPath}`);
  }

  const nulls = collectNullPaths(projection);
  assert(nulls.length === 0, `${sample.name} returned null values: ${nulls.slice(0, 12).join(", ")}`);

  assert(projection.year === expectedYear, `${sample.name} year mismatch`);
  assert(projection.scenario === expectedScenario, `${sample.name} scenario mismatch`);
  assert(projection.metadata.scenario === expectedScenario, `${sample.name} metadata scenario mismatch`);
  assert(Array.isArray(projection.temperature.monthly), `${sample.name} temperature.monthly missing`);
  assert(projection.temperature.monthly.length === 12, `${sample.name} temperature.monthly length is not 12`);
  assert(Array.isArray(projection.temperature.monthly_labels), `${sample.name} temperature.monthly_labels missing`);
  assert(projection.temperature.monthly_labels.length === 12, `${sample.name} temperature.monthly_labels length is not 12`);
  assert(Array.isArray(projection.precipitation.monthly), `${sample.name} precipitation.monthly missing`);
  assert(projection.precipitation.monthly.length === 12, `${sample.name} precipitation.monthly length is not 12`);
  assert(Array.isArray(projection.precipitation.monthly_labels), `${sample.name} precipitation.monthly_labels missing`);
  assert(projection.precipitation.monthly_labels.length === 12, `${sample.name} precipitation.monthly_labels length is not 12`);

  assert(projection.extremes.heat_stress_days >= 0 && projection.extremes.heat_stress_days <= 366, `${sample.name} heat_stress_days out of range`);
  assert(projection.extremes.drought_risk >= 0 && projection.extremes.drought_risk <= 100, `${sample.name} drought_risk out of 0-100 range`);
  assert(projection.extremes.flood_risk >= 0 && projection.extremes.flood_risk <= 100, `${sample.name} flood_risk out of 0-100 range`);
  assert(projection.habitability.score >= 0 && projection.habitability.score <= 100, `${sample.name} habitability score out of range`);
  assert(projection.temperature.uncertainty.annual_mean_low <= projection.temperature.annual_mean, `${sample.name} temperature uncertainty low above mean`);
  assert(projection.temperature.uncertainty.annual_mean_high >= projection.temperature.annual_mean, `${sample.name} temperature uncertainty high below mean`);
  assert(projection.precipitation.uncertainty.annual_total_low <= projection.precipitation.annual_total, `${sample.name} precipitation uncertainty low above total`);
  assert(projection.precipitation.uncertainty.annual_total_high >= projection.precipitation.annual_total, `${sample.name} precipitation uncertainty high below total`);
  assert(projection.extremes.detail.uncertainty.sea_level_low_cm <= projection.extremes.sea_level_rise_cm, `${sample.name} sea-level low above median`);
  assert(projection.extremes.detail.uncertainty.sea_level_high_cm >= projection.extremes.sea_level_rise_cm, `${sample.name} sea-level high below median`);
  assert(Array.isArray(projection.metadata.source_trail), `${sample.name} source trail missing`);
  assert(projection.metadata.source_trail.length >= 4, `${sample.name} source trail incomplete`);
  assert(/WorldClim|CMIP6/.test(projection.metadata.baseline_source.temperature), `${sample.name} temperature baseline source missing provenance`);
  assert(/WorldClim|CMIP6/.test(projection.metadata.baseline_source.precipitation), `${sample.name} precipitation baseline source missing provenance`);
  projection.metadata.source_trail.forEach((entry, index) => {
    assert(entry.label && entry.source && entry.method && entry.citation, `${sample.name} source trail entry ${index} incomplete`);
  });
}

function validateKnownRegressions(results) {
  const byName = new Map(results.map((item) => [item.sample.name, item.projection]));
  const mumbai = byName.get("Mumbai");
  assert(mumbai.precipitation.annual_total > 1000, "Mumbai annual precipitation regression: monsoon total too low");
  assert(mumbai.precipitation.wettest_month_name === "Jul", "Mumbai monsoon regression: wettest month is not July");
  assert(mumbai.precipitation.wettest_month > 300, "Mumbai monsoon regression: wettest month below 300 mm");

  const singapore = byName.get("Singapore");
  assert(singapore.extremes.heat_stress_days >= 300, "Singapore tropical-night regression: heat stress days unexpectedly low");
}

for (const requiredFile of [modelPath, gridPath, manifestPath, worldclimPath, worldclimManifestPath]) {
  assert(existsSync(requiredFile), `Required file missing: ${path.relative(repoRoot, requiredFile)}`);
}

const pythonBin = findPython();
const results = samples.map((sample) => {
  const projection = runModel(pythonBin, sample);
  validateProjection(sample, projection);
  return { sample, projection };
});

validateKnownRegressions(results);

const trajectoryYears = [2025, 2050, 2075, 2100];
const trajectorySample = samples[0];
const trajectory = runTrajectory(pythonBin, trajectorySample, trajectoryYears);
assert(
  JSON.stringify(trajectory.coordinates) === JSON.stringify({ lat: trajectorySample.lat, lng: trajectorySample.lng }),
  "trajectory coordinates mismatch",
);
assert(trajectory.scenario === "ssp245", "trajectory scenario mismatch");
assert(Array.isArray(trajectory.points), "trajectory points missing");
assert(trajectory.points.length === trajectoryYears.length, "trajectory point count mismatch");
trajectory.points.forEach((point, index) => {
  validateProjection(trajectorySample, point, trajectoryYears[index]);
});

const highScenarioTrajectory = runTrajectory(pythonBin, trajectorySample, [2025, 2050], "ssp585");
assert(highScenarioTrajectory.scenario === "ssp585", "non-default trajectory scenario mismatch");
assert(Array.isArray(highScenarioTrajectory.points), "non-default trajectory points missing");
assert(highScenarioTrajectory.points.length === 2, "non-default trajectory point count mismatch");
highScenarioTrajectory.points.forEach((point, index) => {
  validateProjection(trajectorySample, point, [2025, 2050][index], "ssp585");
});

assertInvalidYearRejected(pythonBin);

for (const { sample, projection } of results) {
  console.log(
    `${sample.name}: temp=${projection.temperature.annual_mean}C precip=${projection.precipitation.annual_total}mm ` +
      `heat=${projection.extremes.heat_stress_days}d drought=${projection.extremes.drought_risk} flood=${projection.extremes.flood_risk} ` +
      `score=${projection.habitability.score}`,
  );
}
console.log(`grounded_model contract smoke passed for ${samples.length} cities using ${pythonBin}`);
console.log(`grounded_model trajectory smoke passed for ${trajectorySample.name} years ${trajectoryYears.join(",")}`);
console.log("grounded_model non-default scenario trajectory smoke passed for ssp585");
console.log("grounded_model rejects forecast years beyond 2100");
