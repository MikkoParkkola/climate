import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sampleObservedBaseline } from "../server/grid-reader.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pythonBin = process.env.PYTHON_BIN || "python3";
const checkedYear = 2025;
const scenario = "ssp245";
const jsonOutput = process.env.FUPIT_BASELINE_AUDIT_JSON === "1";

const cities = [
  ["Helsinki", 60.1699, 24.9384],
  ["London", 51.5074, -0.1278],
  ["Amsterdam", 52.3676, 4.9041],
  ["Paris", 48.8566, 2.3522],
  ["Prague", 50.0755, 14.4378],
  ["Kyiv", 50.4501, 30.5234],
  ["Bangkok", 13.7563, 100.5018],
  ["New York", 40.7128, -74.006],
  ["San Francisco", 37.7749, -122.4194],
  ["Singapore", 1.3521, 103.8198],
  ["Mumbai", 19.076, 72.8777],
  ["Cairo", 30.0444, 31.2357],
  ["Manaus", -3.119, -60.0217],
];

function emit(line) {
  if (!jsonOutput) console.log(line);
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function finite(values) {
  return values.filter(Number.isFinite);
}

function directObservedBaseline(lat, lng) {
  const temperature = finite(Array.from({ length: 12 }, (_, index) => sampleObservedBaseline("temperature", lat, lng, index + 1)));
  const precipitation = finite(Array.from({ length: 12 }, (_, index) => sampleObservedBaseline("precipitation", lat, lng, index + 1)));
  assert.equal(temperature.length, 12, `WorldClim temperature baseline missing months at ${lat},${lng}`);
  assert.equal(precipitation.length, 12, `WorldClim precipitation baseline missing months at ${lat},${lng}`);
  return {
    observedAnnualTemperatureC: temperature.reduce((sum, value) => sum + value, 0) / temperature.length,
    observedAnnualPrecipitationMm: precipitation.reduce((sum, value) => sum + value, 0),
  };
}

function runPythonProjection(name, lat, lng) {
  const result = spawnSync(pythonBin, ["grounded_model.py", String(lat), String(lng), String(checkedYear), scenario], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${name}: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

const results = cities.map(([name, lat, lng]) => {
  const direct = directObservedBaseline(lat, lng);
  const projection = runPythonProjection(name, lat, lng);
  const baseline = projection.metadata?.baseline_source ?? {};
  const basis = projection.metadata?.projection_year_basis ?? {};
  assert.equal(baseline.observed_temperature_months, 12, `${name}: Python did not use all 12 observed temperature months`);
  assert.equal(baseline.observed_precipitation_months, 12, `${name}: Python did not use all 12 observed precipitation months`);
  assert.equal(basis.mode, "clamped-earliest-source-year", `${name}: ${checkedYear} should disclose earliest source-year mode`);
  assert.equal(basis.source_year_low, 2030, `${name}: source year low should be 2030`);
  assert.equal(basis.source_year_high, 2030, `${name}: source year high should be 2030`);

  const temperatureDifferenceC = Math.abs(baseline.observed_annual_temperature_c - direct.observedAnnualTemperatureC);
  const precipitationDifferenceMm = Math.abs(baseline.observed_annual_precipitation_mm - direct.observedAnnualPrecipitationMm);
  assert.ok(temperatureDifferenceC <= 0.02, `${name}: observed annual temperature mismatch ${temperatureDifferenceC.toFixed(4)}C`);
  assert.ok(precipitationDifferenceMm <= 0.05, `${name}: observed annual precipitation mismatch ${precipitationDifferenceMm.toFixed(4)}mm`);

  return {
    name,
    lat,
    lng,
    checkedYear,
    scenario,
    pythonObservedAnnualTemperatureC: baseline.observed_annual_temperature_c,
    directObservedAnnualTemperatureC: round(direct.observedAnnualTemperatureC),
    temperatureDifferenceC: round(temperatureDifferenceC, 4),
    pythonObservedAnnualPrecipitationMm: baseline.observed_annual_precipitation_mm,
    directObservedAnnualPrecipitationMm: round(direct.observedAnnualPrecipitationMm),
    precipitationDifferenceMm: round(precipitationDifferenceMm, 4),
    projectionYearBasis: basis,
  };
});

const maxTemperatureDifferenceC = Math.max(...results.map((item) => item.temperatureDifferenceC));
const maxPrecipitationDifferenceMm = Math.max(...results.map((item) => item.precipitationDifferenceMm));

if (jsonOutput) {
  console.log(JSON.stringify({
    version: "observed-baseline-audit-v1",
    generatedAt: new Date().toISOString(),
    source: "WorldClim v2.1 current conditions, 10 arc-minute monthly climatology (1970-2000)",
    checkedYear,
    scenario,
    cityCount: results.length,
    maxTemperatureDifferenceC,
    maxPrecipitationDifferenceMm,
    note: "This validates packaged observed-baseline decoding and provenance for fixture cities. It is not a historical hindcast skill test.",
    results,
  }, null, 2));
} else {
  for (const result of results) {
    emit(
      `${result.name}: WorldClim baseline ${result.pythonObservedAnnualTemperatureC}C, ` +
        `${result.pythonObservedAnnualPrecipitationMm}mm; source year ${result.projectionYearBasis.source_year_low}`,
    );
  }
  emit(
    `observed-baseline audit passed for ${results.length} cities; ` +
      `max diff ${maxTemperatureDifferenceC.toFixed(4)}C / ${maxPrecipitationDifferenceMm.toFixed(4)}mm`,
  );
}
