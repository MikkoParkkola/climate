import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pythonBin = process.env.PYTHON_BIN || "python3";
const supportedScenarios = ["ssp126", "ssp245", "ssp370", "ssp585"];
const scenarios = (process.env.FUPIT_AUDIT_SCENARIOS || "all")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean)
  .flatMap((item) => (item === "all" ? supportedScenarios : [item]));
const baselineYear = 2025;
const maxYear = 2100;
const years = Array.from({ length: maxYear - baselineYear + 1 }, (_, i) => baselineYear + i);
const jsonOutput = process.env.FUPIT_AUDIT_JSON === "1";

function emit(line) {
  if (!jsonOutput) console.log(line);
}

const cities = [
  ["Helsinki", 60.1699, 24.9384],
  ["London", 51.5074, -0.1278],
  ["Amsterdam", 52.3676, 4.9041],
  ["Paris", 48.8566, 2.3522],
  ["Prague", 50.0755, 14.4378],
  ["Kyiv", 50.4501, 30.5234],
  ["Bangkok", 13.7563, 100.5018],
  ["New York", 40.7128, -74.0060],
  ["San Francisco", 37.7749, -122.4194],
  ["Singapore", 1.3521, 103.8198],
  ["Mumbai", 19.0760, 72.8777],
  ["Cairo", 30.0444, 31.2357],
  ["Manaus", -3.1190, -60.0217],
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

    const monthlyTemp = point.temperature.monthly;
    const monthlyPrecip = point.precipitation.monthly;
    if (point.temperature.annual_mean < -80 || point.temperature.annual_mean > 70) {
      failures.push(`${point.year} implausible annual temperature ${point.temperature.annual_mean}`);
    }
    if (monthlyTemp.some((value) => value < -100 || value > 80)) {
      failures.push(`${point.year} implausible monthly temperature`);
    }
    if (point.precipitation.annual_total < 0 || point.precipitation.annual_total > 15000) {
      failures.push(`${point.year} implausible annual precipitation ${point.precipitation.annual_total}`);
    }
    if (monthlyPrecip.some((value) => value < 0 || value > 3500)) {
      failures.push(`${point.year} implausible monthly precipitation`);
    }
    if (point.extremes.heat_stress_days < 0 || point.extremes.heat_stress_days > 366) {
      failures.push(`${point.year} heat_stress_days out of range`);
    }
    for (const key of ["drought_risk", "flood_risk"]) {
      if (point.extremes[key] < 0 || point.extremes[key] > 100) {
        failures.push(`${point.year} ${key} out of range`);
      }
    }
    if (point.habitability.score < 0 || point.habitability.score > 100) {
      failures.push(`${point.year} habitability score out of range`);
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

function runCity([name, lat, lng], scenario) {
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
      maxPrecipStep: precipStats.maxAbsStep,
      maxScoreSlopeChange: scoreStats.maxSlopeChange,
    },
  };
}

for (const scenario of scenarios) {
  if (!supportedScenarios.includes(scenario)) {
    throw new Error(`Unsupported audit scenario "${scenario}". Expected one of ${supportedScenarios.join(", ")} or "all".`);
  }
}

const allResults = [];
for (const scenario of scenarios) {
  const results = cities.map((city) => runCity(city, scenario));
  allResults.push(...results.map((result) => ({ ...result, scenario })));
  emit(`Trajectory audit ${scenario}: ${cities.length} cities, ${years.length} annual points each (${baselineYear}-${maxYear})`);
  for (const result of results) emit(result.summary);
}

const trendReview = allResults.filter((result) =>
  result.warnings.anomalyDownYears.length > 0 ||
  result.warnings.tempDownYears.length > 0 ||
  result.warnings.tempMaxSlopeChange > 0.12 ||
  result.warnings.maxPrecipStep > 25 ||
  result.warnings.scoreDirectionChanges > 6 ||
  result.warnings.maxScoreSlopeChange > 5
);

function reviewFlags(result) {
  const flags = [];
  if (result.warnings.anomalyDownYears.length > 0) flags.push(`anomalyDown=${result.warnings.anomalyDownYears.join("|")}`);
  if (result.warnings.tempDownYears.length > 0) flags.push(`tempDown=${result.warnings.tempDownYears.join("|")}`);
  if (result.warnings.tempMaxSlopeChange > 0.12) flags.push(`tempSlopeBreak=${fmt(result.warnings.tempMaxSlopeChange)}C/yr`);
  if (result.warnings.maxPrecipStep > 25) flags.push(`precipStep=${fmt(result.warnings.maxPrecipStep, 1)}mm`);
  if (result.warnings.scoreDirectionChanges > 6) flags.push(`scoreDirChanges=${result.warnings.scoreDirectionChanges}`);
  if (result.warnings.maxScoreSlopeChange > 5) flags.push(`scoreSlopeBreak=${fmt(result.warnings.maxScoreSlopeChange, 1)}pts/yr`);
  return flags;
}

if (jsonOutput) {
  console.log(JSON.stringify({
    version: "trajectory-audit-summary-v1",
    generatedAt: new Date().toISOString(),
    model: "grounded_model.py",
    baselineYear,
    maxYear,
    yearCount: years.length,
    supportedScenarios,
    scenarios,
    cityCount: cities.length,
    cities: cities.map(([name, lat, lng]) => ({ name, lat, lng })),
    requiredPaths,
    resultCount: allResults.length,
    summaries: allResults.map((result) => ({
      scenario: result.scenario,
      name: result.name,
      summary: result.summary,
      warnings: result.warnings,
    })),
    trendReview: trendReview.map((result) => ({
      scenario: result.scenario,
      name: result.name,
      flags: reviewFlags(result),
    })),
    note: "Trend review flags are reported for human scientific review, not auto-failed.",
  }, null, 2));
} else if (trendReview.length > 0) {
  emit("Trend review flags (reported for human scientific review, not auto-failed):");
  for (const result of trendReview) {
    emit(`- ${result.scenario} ${result.name}: ${reviewFlags(result).join("; ")}`);
  }
}
