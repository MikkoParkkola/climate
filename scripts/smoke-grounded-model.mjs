#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modelPath = path.join(repoRoot, "grounded_model.py");
const gridPath = path.join(repoRoot, "data", "grid.i16.gz");
const manifestPath = path.join(repoRoot, "data", "manifest.json");

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
  "precipitation.annual_total",
  "precipitation.anomaly_percent",
  "precipitation.wettest_month",
  "precipitation.driest_month",
  "precipitation.wettest_month_name",
  "precipitation.driest_month_name",
  "extremes.heat_stress_days",
  "extremes.drought_risk",
  "extremes.flood_risk",
  "extremes.sea_level_rise_cm",
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
  "metadata.projection_method",
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

function runModel(pythonBin, sample, year = 2050) {
  const result = spawnSync(
    pythonBin,
    [modelPath, String(sample.lat), String(sample.lng), String(year)],
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

function runTrajectory(pythonBin, sample, years) {
  const result = spawnSync(
    pythonBin,
    [modelPath, "--trajectory", String(sample.lat), String(sample.lng), years.join(",")],
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

function findPython() {
  const candidates = [process.env.PYTHON_BIN, "python3", "python"].filter(Boolean);
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["-c", "import numpy"], { encoding: "utf8" });
    if (result.status === 0) return candidate;
  }
  throw new Error("No python executable with numpy available. Install numpy or set PYTHON_BIN.");
}

function validateProjection(sample, projection, expectedYear = 2050) {
  for (const requiredPath of requiredPaths) {
    assert(getPath(projection, requiredPath) !== undefined, `${sample.name} missing ${requiredPath}`);
  }

  const nulls = collectNullPaths(projection);
  assert(nulls.length === 0, `${sample.name} returned null values: ${nulls.slice(0, 12).join(", ")}`);

  assert(projection.year === expectedYear, `${sample.name} year mismatch`);
  assert(projection.scenario === "ssp245", `${sample.name} scenario mismatch`);
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

for (const requiredFile of [modelPath, gridPath, manifestPath]) {
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
assert(Array.isArray(trajectory.points), "trajectory points missing");
assert(trajectory.points.length === trajectoryYears.length, "trajectory point count mismatch");
trajectory.points.forEach((point, index) => {
  validateProjection(trajectorySample, point, trajectoryYears[index]);
});

for (const { sample, projection } of results) {
  console.log(
    `${sample.name}: temp=${projection.temperature.annual_mean}C precip=${projection.precipitation.annual_total}mm ` +
      `heat=${projection.extremes.heat_stress_days}d drought=${projection.extremes.drought_risk} flood=${projection.extremes.flood_risk} ` +
      `score=${projection.habitability.score}`,
  );
}
console.log(`grounded_model contract smoke passed for ${samples.length} cities using ${pythonBin}`);
console.log(`grounded_model trajectory smoke passed for ${trajectorySample.name} years ${trajectoryYears.join(",")}`);
