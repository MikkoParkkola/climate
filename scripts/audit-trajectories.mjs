import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pythonBin = process.env.PYTHON_BIN || "python3";
const scenario = process.env.FUPIT_AUDIT_SCENARIO || "ssp245";
const baselineYear = 2025;
const maxYear = 2100;
const years = Array.from({ length: maxYear - baselineYear + 1 }, (_, i) => baselineYear + i);

const cities = [
  ["Amsterdam", 52.3676, 4.9041],
  ["Paris", 48.8566, 2.3522],
  ["London", 51.5074, -0.1278],
  ["Helsinki", 60.1699, 24.9384],
  ["Prague", 50.0755, 14.4378],
  ["Kyiv", 50.4501, 30.5234],
  ["Bangkok", 13.7563, 100.5018],
  ["New York", 40.7128, -74.0060],
  ["San Francisco", 37.7749, -122.4194],
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
  "habitability.score",
];

function valueAt(obj, dotted) {
  return dotted.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function assertCoreContract(city, points) {
  const failures = [];
  if (points.length !== years.length) {
    failures.push(`expected ${years.length} points, got ${points.length}`);
  }

  for (const point of points) {
    for (const pathName of requiredPaths) {
      const value = valueAt(point, pathName);
      if (value == null || Number.isNaN(value)) {
        failures.push(`${point.year} missing ${pathName}`);
      }
    }

    for (const pathName of ["temperature.monthly", "temperature.ipcc_calibrated.monthly", "precipitation.monthly"]) {
      const value = valueAt(point, pathName);
      if (!Array.isArray(value) || value.length !== 12 || value.some((item) => item == null || Number.isNaN(item))) {
        failures.push(`${point.year} invalid ${pathName}`);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`${city}: contract failures: ${failures.slice(0, 8).join("; ")}${failures.length > 8 ? "; ..." : ""}`);
  }
}

function trendStats(values, epsilon = 0.000001) {
  const steps = [];
  const decreases = [];
  for (let i = 1; i < values.length; i++) {
    const step = values[i] - values[i - 1];
    steps.push(step);
    if (step < -epsilon) decreases.push(years[i]);
  }

  let maxAbsStep = 0;
  let maxAbsStepYear = years[1];
  for (let i = 0; i < steps.length; i++) {
    const abs = Math.abs(steps[i]);
    if (abs > maxAbsStep) {
      maxAbsStep = abs;
      maxAbsStepYear = years[i + 1];
    }
  }

  let maxSlopeChange = 0;
  let maxSlopeChangeYear = years[2];
  for (let i = 1; i < steps.length; i++) {
    const abs = Math.abs(steps[i] - steps[i - 1]);
    if (abs > maxSlopeChange) {
      maxSlopeChange = abs;
      maxSlopeChangeYear = years[i + 1];
    }
  }

  let directionChanges = 0;
  let previousSign = 0;
  for (const step of steps) {
    const sign = step > epsilon ? 1 : step < -epsilon ? -1 : 0;
    if (sign !== 0 && previousSign !== 0 && sign !== previousSign) directionChanges++;
    if (sign !== 0) previousSign = sign;
  }

  return { decreases, maxAbsStep, maxAbsStepYear, maxSlopeChange, maxSlopeChangeYear, directionChanges };
}

function fmt(value, digits = 2) {
  return Number(value).toFixed(digits);
}

function runCity([name, lat, lng]) {
  const child = spawnSync(
    pythonBin,
    ["grounded_model.py", "--trajectory", String(lat), String(lng), years.join(","), scenario],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );

  if (child.status !== 0) {
    throw new Error(`${name}: grounded_model.py failed: ${child.stderr.trim() || `exit ${child.status}`}`);
  }

  const output = JSON.parse(child.stdout);
  const points = [...output.points].sort((a, b) => a.year - b.year);
  assertCoreContract(name, points);

  const temp = points.map((p) => p.temperature.annual_mean);
  const anomaly = points.map((p) => p.temperature.anomaly);
  const precip = points.map((p) => p.precipitation.annual_total);
  const score = points.map((p) => p.habitability.score);
  const tempStats = trendStats(temp, 0.01);
  const anomalyStats = trendStats(anomaly, 0.01);
  const precipStats = trendStats(precip, 0.5);
  const scoreStats = trendStats(score, 0.05);
  const last = points[points.length - 1];

  return {
    name,
    summary:
      `${name}: contract OK; temp ${fmt(temp[0])}->${fmt(temp[temp.length - 1])}C; ` +
      `anomaly ${fmt(anomaly[0])}->${fmt(anomaly[anomaly.length - 1])}C; ` +
      `ipccAdj2100 ${fmt(last.temperature.ipcc_calibrated.adjustment_c)}C; ` +
      `tempDownYears=${tempStats.decreases.length ? tempStats.decreases.join(",") : "none"}; ` +
      `maxTempStep=${fmt(tempStats.maxAbsStep)}C at ${tempStats.maxAbsStepYear}; ` +
      `maxTempSlopeBreak=${fmt(tempStats.maxSlopeChange)}C/yr at ${tempStats.maxSlopeChangeYear}; ` +
      `precipDirChanges=${precipStats.directionChanges}; ` +
      `maxPrecipStep=${fmt(precipStats.maxAbsStep, 1)}mm at ${precipStats.maxAbsStepYear}; ` +
      `scoreDirChanges=${scoreStats.directionChanges}; score ${fmt(score[0], 1)}->${fmt(score[score.length - 1], 1)}`,
    warnings: {
      anomalyDownYears: anomalyStats.decreases,
      tempDownYears: tempStats.decreases,
      tempMaxSlopeChange: tempStats.maxSlopeChange,
      precipDirectionChanges: precipStats.directionChanges,
      scoreDirectionChanges: scoreStats.directionChanges,
    },
  };
}

const results = cities.map(runCity);
console.log(`Trajectory audit ${scenario}: ${cities.length} cities, ${years.length} annual points each (${baselineYear}-${maxYear})`);
for (const result of results) console.log(result.summary);

const tempWarnings = results.filter((result) => result.warnings.tempDownYears.length > 0);
if (tempWarnings.length > 0) {
  console.log("Temperature decrease warnings:");
  for (const result of tempWarnings) {
    console.log(`- ${result.name}: ${result.warnings.tempDownYears.join(", ")}`);
  }
}
