#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sampleObservedBaseline } from "../server/grid-reader.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(repoRoot, "data", "observed-climatology-validation.nasa-power.json");

const period = { start: 1981, end: 2000 };
const sourceIds = ["worldclim-v2-1", "nasa-power-meteorology-monthly-v10"];
const cities = [
  ["Helsinki", "Finland", 60.1699, 24.9384],
  ["London", "United Kingdom", 51.5074, -0.1278],
  ["Amsterdam", "Netherlands", 52.3676, 4.9041],
  ["Paris", "France", 48.8566, 2.3522],
  ["Prague", "Czechia", 50.0755, 14.4378],
  ["Kyiv", "Ukraine", 50.4501, 30.5234],
  ["Bangkok", "Thailand", 13.7563, 100.5018],
  ["New York", "United States", 40.7128, -74.006],
  ["San Francisco", "United States", 37.7749, -122.4194],
  ["Singapore", "Singapore", 1.3521, 103.8198],
  ["Mumbai", "India", 19.076, 72.8777],
  ["Cairo", "Egypt", 30.0444, 31.2357],
  ["Manaus", "Brazil", -3.119, -60.0217],
];

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isUsable(value) {
  return Number.isFinite(value) && value > -900;
}

async function fetchJson(url, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 220)}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function loadPowerMetadata() {
  const url = new URL("https://power.larc.nasa.gov/api/system/manager/parameters");
  url.search = new URLSearchParams({
    parameters: "T2M,PRECTOTCORR",
    community: "AG",
    temporal: "monthly",
  });
  return fetchJson(url);
}

async function loadPowerPoint(lat, lng) {
  const url = new URL("https://power.larc.nasa.gov/api/temporal/monthly/point");
  url.search = new URLSearchParams({
    parameters: "T2M,PRECTOTCORR",
    community: "AG",
    longitude: String(lng),
    latitude: String(lat),
    start: String(period.start),
    end: String(period.end),
    format: "JSON",
  });
  return fetchJson(url);
}

function worldClimBaseline(lat, lng) {
  let tempWeighted = 0;
  let tempDays = 0;
  let precipTotal = 0;
  for (let month = 1; month <= 12; month += 1) {
    const days = daysInMonth(1999, month);
    const temperature = sampleObservedBaseline("temperature", lat, lng, month);
    const precipitation = sampleObservedBaseline("precipitation", lat, lng, month);
    if (!isUsable(temperature) || !isUsable(precipitation)) {
      throw new Error(`WorldClim baseline missing month ${month} for ${lat},${lng}`);
    }
    tempWeighted += temperature * days;
    tempDays += days;
    precipTotal += precipitation;
  }
  return {
    annualMeanTemperatureC: tempWeighted / tempDays,
    annualPrecipitationMm: precipTotal,
  };
}

function powerClimatology(powerResponse) {
  const parameters = powerResponse?.properties?.parameter;
  const t2m = parameters?.T2M;
  const precip = parameters?.PRECTOTCORR;
  if (!t2m || !precip) throw new Error("NASA POWER response missing T2M/PRECTOTCORR parameters");

  const annual = [];
  for (let year = period.start; year <= period.end; year += 1) {
    let tempWeighted = 0;
    let tempDays = 0;
    let precipTotal = 0;
    for (let month = 1; month <= 12; month += 1) {
      const key = `${year}${String(month).padStart(2, "0")}`;
      const days = daysInMonth(year, month);
      if (!isUsable(t2m[key]) || !isUsable(precip[key])) {
        throw new Error(`NASA POWER response missing ${key}`);
      }
      tempWeighted += t2m[key] * days;
      tempDays += days;
      precipTotal += precip[key] * days;
    }
    annual.push({
      year,
      annualMeanTemperatureC: tempWeighted / tempDays,
      annualPrecipitationMm: precipTotal,
    });
  }

  return {
    annualMeanTemperatureC: annual.reduce((sum, item) => sum + item.annualMeanTemperatureC, 0) / annual.length,
    annualPrecipitationMm: annual.reduce((sum, item) => sum + item.annualPrecipitationMm, 0) / annual.length,
    yearCount: annual.length,
  };
}

function classify({ temperatureDifferenceC, precipitationDifferenceMm, nasaPowerAnnualPrecipitationMm }) {
  const flags = [];
  const precipitationRelativeDifferencePercent = nasaPowerAnnualPrecipitationMm > 0
    ? Math.abs(precipitationDifferenceMm) / nasaPowerAnnualPrecipitationMm * 100
    : null;

  if (Math.abs(temperatureDifferenceC) > 2) flags.push("temperature-difference-over-2c");
  if (nasaPowerAnnualPrecipitationMm >= 100 && precipitationRelativeDifferencePercent > 30) {
    flags.push("precipitation-relative-difference-over-30pct");
  }
  if (nasaPowerAnnualPrecipitationMm < 100 && Math.abs(precipitationDifferenceMm) > 50) {
    flags.push("dry-site-precipitation-absolute-difference-over-50mm");
  }
  if (nasaPowerAnnualPrecipitationMm < 100 && precipitationRelativeDifferencePercent > 30) {
    flags.push("dry-site-relative-precipitation-difference-high");
  }

  return {
    flags,
    precipitationRelativeDifferencePercent,
  };
}

const powerMetadata = await loadPowerMetadata();
const results = [];

for (const [name, country, lat, lng] of cities) {
  const worldClim = worldClimBaseline(lat, lng);
  const power = powerClimatology(await loadPowerPoint(lat, lng));
  const temperatureDifferenceC = worldClim.annualMeanTemperatureC - power.annualMeanTemperatureC;
  const precipitationDifferenceMm = worldClim.annualPrecipitationMm - power.annualPrecipitationMm;
  const classification = classify({
    temperatureDifferenceC,
    precipitationDifferenceMm,
    nasaPowerAnnualPrecipitationMm: power.annualPrecipitationMm,
  });

  results.push({
    name,
    country,
    lat,
    lng,
    worldClimAnnualMeanTemperatureC: round(worldClim.annualMeanTemperatureC),
    nasaPowerAnnualMeanTemperatureC: round(power.annualMeanTemperatureC),
    temperatureDifferenceC: round(temperatureDifferenceC),
    worldClimAnnualPrecipitationMm: round(worldClim.annualPrecipitationMm),
    nasaPowerAnnualPrecipitationMm: round(power.annualPrecipitationMm),
    precipitationDifferenceMm: round(precipitationDifferenceMm),
    precipitationRelativeDifferencePercent: classification.precipitationRelativeDifferencePercent === null
      ? null
      : round(classification.precipitationRelativeDifferencePercent, 1),
    flags: classification.flags,
  });
}

const temperatureAbs = results.map((result) => Math.abs(result.temperatureDifferenceC));
const precipitationAbs = results.map((result) => Math.abs(result.precipitationDifferenceMm));
const precipitationRelative = results
  .map((result) => result.precipitationRelativeDifferencePercent)
  .filter(Number.isFinite);
const reviewFlags = results.flatMap((result) =>
  result.flags.map((flag) => ({ name: result.name, country: result.country, flag })),
);

const artifact = {
  version: "nasa-power-observed-climatology-validation-v1",
  generatedAt: new Date().toISOString(),
  status: reviewFlags.some((item) => !item.flag.startsWith("dry-site-relative"))
    ? "review-required"
    : "passed-with-caveats",
  sourceIds,
  comparisonType: "observed-climatology-baseline-comparison",
  period,
  cityCount: results.length,
  method: [
    "Sample the packaged WorldClim v2.1 observed monthly baseline at each fixture coordinate.",
    "Fetch NASA POWER monthly point data for T2M and PRECTOTCORR over the overlapping 1981-2000 period.",
    "Compute annual mean temperature as a day-weighted mean of monthly T2M and annual precipitation as the sum of monthly PRECTOTCORR mm/day times days in month, then average annual values over the period.",
    "Compare the two independent observed climatology products as a baseline sanity check only; this is not a future projection hindcast.",
  ],
  units: {
    temperature: powerMetadata.T2M?.units ?? "C",
    precipitation: `${powerMetadata.PRECTOTCORR?.units ?? "mm/day"} converted to annual mm by month-length weighting`,
  },
  parameterMetadata: {
    T2M: powerMetadata.T2M,
    PRECTOTCORR: powerMetadata.PRECTOTCORR,
  },
  thresholds: {
    temperatureReview: "absolute difference > 2 C",
    precipitationReview: "relative difference > 30% when NASA POWER annual precipitation >= 100 mm; absolute difference > 50 mm when NASA POWER annual precipitation < 100 mm",
    drySiteNote: "relative precipitation percentages are unstable for very dry sites and are reported as caveats rather than automatic failures when absolute difference stays <= 50 mm",
  },
  summary: {
    maxAbsTemperatureDifferenceC: round(Math.max(...temperatureAbs), 2),
    meanAbsTemperatureDifferenceC: round(temperatureAbs.reduce((sum, value) => sum + value, 0) / temperatureAbs.length, 2),
    maxAbsPrecipitationDifferenceMm: round(Math.max(...precipitationAbs), 2),
    meanAbsPrecipitationDifferenceMm: round(precipitationAbs.reduce((sum, value) => sum + value, 0) / precipitationAbs.length, 2),
    maxAbsPrecipitationRelativeDifferencePercent: round(Math.max(...precipitationRelative.map(Math.abs)), 1),
    reviewFlagCount: reviewFlags.length,
  },
  caveats: [
    "NASA POWER/MERRA-2 and WorldClim are independent gridded products with different source data, spatial resolution, bias correction, and averaging periods.",
    "This validates that the packaged observed baseline is broadly consistent with an external observation/reanalysis product for fixture cities.",
    "This does not validate future CMIP6 scenario trends, local station microclimates, parcel-scale exposure, or historical forecast skill.",
    "Precipitation differences can be large in dry or coastal-grid locations and should be interpreted as data-product uncertainty, not a correction factor.",
  ],
  reviewFlags,
  results,
};

writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(
  `wrote ${path.relative(repoRoot, outPath)}: ` +
    `${artifact.cityCount} cities, max |temp diff| ${artifact.summary.maxAbsTemperatureDifferenceC} C, ` +
    `max |precip diff| ${artifact.summary.maxAbsPrecipitationDifferenceMm} mm, flags ${artifact.summary.reviewFlagCount}`,
);
