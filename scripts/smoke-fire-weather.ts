import assert from "node:assert/strict";
import { lookupFireWeather, fireWeatherArtifactSummary } from "../server/fire-weather";

// Grounded fire-weather (Quilcaille et al. 2023, CMIP6 Canadian FWI) smoke test: the
// artifact loads, fire-prone regions resolve to rising extreme-fire-weather days, the
// warming scenarios are ordered (more warming -> more fire weather), open ocean and an
// unsupported scenario return null (never a fabricated value), and horizons are stable.

const summary = fireWeatherArtifactSummary();
assert.equal(summary.sourceId, "quilcaille-2023-fire-weather-v1");
assert.equal(summary.license, "cc-by-4.0");
assert.ok(summary.attribution.includes("Quilcaille"), "attribution should cite Quilcaille");
assert.deepEqual(summary.years, [2030, 2050, 2080]);
assert.equal(summary.resolutionDegrees, 2.5);
assert.ok(summary.modelCount >= 20, `expected >=20 CMIP6 models, got ${summary.modelCount}`);

// Fire-prone regions -> numeric indicators, rising from 2030 to 2080 under SSP5-8.5.
for (const [name, lat, lng] of [
  ["Athens", 37.98, 23.73],
  ["Lisbon", 38.72, -9.14],
  ["Cape Town", -33.92, 18.42],
] as const) {
  const fw = lookupFireWeather(lat, lng, "ssp585");
  assert.ok(fw, `${name} should resolve a fire-weather cell`);
  assert.equal(fw!.scenario, "ssp585");
  assert.equal(fw!.horizons.length, 3);
  const y2030 = fw!.horizons.find((h) => h.year === 2030)!;
  const y2080 = fw!.horizons.find((h) => h.year === 2080)!;
  assert.ok(typeof y2030.extremeFireWeatherDays === "number", `${name} 2030 extreme-fire days should be numeric`);
  assert.ok(typeof y2080.extremeFireWeatherDays === "number", `${name} 2080 extreme-fire days should be numeric`);
  assert.ok(typeof y2080.fireSeasonLengthDays === "number", `${name} 2080 fire-season length should be numeric`);
  assert.ok(
    (y2080.extremeFireWeatherDays ?? 0) > (y2030.extremeFireWeatherDays ?? 0),
    `${name} extreme-fire days should rise toward 2080 under SSP5-8.5`,
  );
  assert.ok(y2080.window === "2071-2090", `${name} 2080 horizon should expose its window`);
}

// Scenario grounding: at a fixed horizon, more warming -> more fire weather (monotone-ish).
const xd2080 = (scenario: string) =>
  lookupFireWeather(37.98, 23.73, scenario)!.horizons.find((h) => h.year === 2080)!.extremeFireWeatherDays!;
assert.ok(xd2080("ssp126") < xd2080("ssp585"), "SSP1-2.6 should be below SSP5-8.5 for Athens 2080");
assert.ok(xd2080("ssp245") <= xd2080("ssp370"), "SSP2-4.5 should not exceed SSP3-7.0 for Athens 2080");

// All four supported scenarios map directly (native SSP data) -> never null for land.
for (const scenario of ["ssp126", "ssp245", "ssp370", "ssp585"]) {
  assert.ok(lookupFireWeather(37.98, 23.73, scenario), `${scenario} should resolve for Athens`);
}

// Unsupported scenario (ssp119 is in the archive but not served) -> null, not a guess.
assert.equal(lookupFireWeather(37.98, 23.73, "ssp119"), null);

// Open ocean is masked out (no fuel) -> null, not a misleading fire-season length.
assert.equal(lookupFireWeather(0, -150, "ssp585"), null);
assert.equal(lookupFireWeather(30, -40, "ssp585"), null);

console.log("fire-weather smoke passed");
