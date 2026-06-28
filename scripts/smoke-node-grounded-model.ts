import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { climateTrajectory, projectClimate } from "../server/grounded-node-model";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pythonBin = process.env.PYTHON_BIN || "python3";
const numericTolerance = 0.011;

const samples = [
  { name: "Helsinki", lat: 60.17, lng: 24.94, year: 2050, scenario: "ssp245" },
  { name: "London", lat: 51.51, lng: -0.13, year: 2065, scenario: "ssp126" },
  { name: "Bangkok", lat: 13.76, lng: 100.5, year: 2080, scenario: "ssp370" },
  { name: "New York", lat: 40.71, lng: -74.01, year: 2100, scenario: "ssp585" },
  { name: "Manaus", lat: -3.12, lng: -60.02, year: 2035, scenario: "ssp245" },
];

const requiredPaths = [
  "temperature.annual_mean",
  "temperature.anomaly",
  "temperature.ipcc_calibrated.annual_mean",
  "temperature.ipcc_calibrated.anomaly",
  "precipitation.annual_total",
  "precipitation.anomaly_percent",
  "extremes.heat_stress_days",
  "extremes.drought_risk",
  "extremes.flood_risk",
  "extremes.sea_level_rise_cm",
  "extremes.detail.humid_heat.max_monthly_mean_wet_bulb_c",
  "extremes.detail.humid_heat.max_month",
  "extremes.detail.humid_heat.relative_humidity_anomaly_percent_points",
  "extremes.detail.humid_heat.relative_humidity_spread_percent_points",
  "extremes.detail.humid_heat.domain_clipped_months",
  "extremes.detail.humid_heat.temperature_domain_warning_months",
  "extremes.detail.humid_heat.source_id",
  "extremes.detail.humid_heat.method",
  "extremes.detail.humid_heat.caveat",
  "habitability.score",
  "metadata.model_version",
  "metadata.baseline_source.temperature",
  "metadata.baseline_source.precipitation",
  "metadata.baseline_source.humidity",
  "metadata.baseline_source.observed_temperature_months",
  "metadata.baseline_source.observed_precipitation_months",
  "metadata.baseline_source.observed_annual_temperature_c",
  "metadata.baseline_source.observed_annual_precipitation_mm",
  "metadata.projection_year_basis.requested_year",
  "metadata.projection_year_basis.source_year_low",
  "metadata.projection_year_basis.source_year_high",
  "metadata.projection_year_basis.mode",
  "metadata.projection_year_basis.cadence",
  "metadata.projection_year_basis.note",
];

function getPath(value: unknown, dottedPath: string): unknown {
  return dottedPath.split(".").reduce<unknown>((current, key) => {
    if (current === null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function runPython(lat: number, lng: number, year: number, scenario: string): Record<string, unknown> {
  const result = spawnSync(pythonBin, ["grounded_model.py", String(lat), String(lng), String(year), scenario], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

function compareValue(label: string, expected: unknown, actual: unknown): void {
  if (typeof expected === "number") {
    assert.equal(typeof actual, "number", `${label}: expected numeric ${expected}, got ${actual}`);
    assert.ok(Math.abs(actual - expected) <= numericTolerance, `${label}: Node ${actual} differed from Python ${expected}`);
    return;
  }

  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${label}: expected array`);
    assert.equal(actual.length, expected.length, `${label}: array length mismatch`);
    expected.forEach((value, index) => compareValue(`${label}[${index}]`, value, actual[index]));
    return;
  }

  assert.deepEqual(actual, expected, label);
}

function compareProjection(label: string, expected: Record<string, unknown>, actual: Record<string, unknown>): void {
  for (const pathName of requiredPaths) {
    assert.notEqual(getPath(actual, pathName), undefined, `${label}: missing ${pathName}`);
  }

  compareValue(`${label}.temperature.monthly`, getPath(expected, "temperature.monthly"), getPath(actual, "temperature.monthly"));
  compareValue(
    `${label}.temperature.ipcc_calibrated.monthly`,
    getPath(expected, "temperature.ipcc_calibrated.monthly"),
    getPath(actual, "temperature.ipcc_calibrated.monthly"),
  );
  compareValue(
    `${label}.precipitation.monthly`,
    getPath(expected, "precipitation.monthly"),
    getPath(actual, "precipitation.monthly"),
  );
  compareValue(
    `${label}.extremes.detail.humid_heat.monthly_mean_wet_bulb_c`,
    getPath(expected, "extremes.detail.humid_heat.monthly_mean_wet_bulb_c"),
    getPath(actual, "extremes.detail.humid_heat.monthly_mean_wet_bulb_c"),
  );
  compareValue(
    `${label}.extremes.detail.humid_heat.monthly_relative_humidity_percent`,
    getPath(expected, "extremes.detail.humid_heat.monthly_relative_humidity_percent"),
    getPath(actual, "extremes.detail.humid_heat.monthly_relative_humidity_percent"),
  );

  for (const pathName of requiredPaths) {
    compareValue(`${label}.${pathName}`, getPath(expected, pathName), getPath(actual, pathName));
  }
}

for (const sample of samples) {
  const expected = runPython(sample.lat, sample.lng, sample.year, sample.scenario);
  const actual = projectClimate(sample.lat, sample.lng, sample.year, sample.scenario);
  compareProjection(sample.name, expected, actual);
}

const trajectoryYears = [2026, 2050, 2075, 2100];
const expectedTrajectory = spawnSync(
  pythonBin,
  ["grounded_model.py", "--trajectory", "60.17", "24.94", trajectoryYears.join(","), "ssp245"],
  { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);
assert.equal(expectedTrajectory.status, 0, expectedTrajectory.stderr || expectedTrajectory.stdout);
const pythonTrajectory = JSON.parse(expectedTrajectory.stdout) as { points: Array<Record<string, unknown>> };
const nodeTrajectory = climateTrajectory(60.17, 24.94, trajectoryYears, "ssp245") as {
  points: Array<Record<string, unknown>>;
};
assert.equal(nodeTrajectory.points.length, pythonTrajectory.points.length);
pythonTrajectory.points.forEach((point, index) => {
  compareProjection(`trajectory[${index}]`, point, nodeTrajectory.points[index]);
});

console.log(`node grounded-model parity smoke passed (${samples.length} projections + ${trajectoryYears.length} trajectory points)`);
