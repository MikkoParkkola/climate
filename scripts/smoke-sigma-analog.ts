// Integration check for sigma-dissimilarity climate-twin novelty (MIK-6788).
// Run: npx tsx scripts/smoke-sigma-analog.ts
//
// Proves the two behaviours the ticket cares about on a synthetic catalog:
//   1. a target close to a catalog city returns that city with a finite, in-band
//      sigma and noAnalog=false;
//   2. a target far outside the catalog's climate space trips the >4σ
//      "no modern equivalent" flag (noAnalog=true).
import { findClimateAnalog } from "../client/src/lib/climate-helpers";
import type { AnalogCandidate, AnalogCatalog, LocationOption } from "../client/src/lib/climate-types";

const seasonal = (baseT: number, amp: number): number[] =>
  Array.from({ length: 12 }, (_, m) => baseT + amp * Math.cos(((m - 6) / 12) * 2 * Math.PI));

function cand(name: string, lat: number, baseT: number, amp: number, precip: number): AnalogCandidate {
  return {
    name,
    country: "XX",
    lat,
    lng: 0,
    year: 2025,
    scenario: "ssp245",
    temperature: { annual_mean: baseT, monthly: seasonal(baseT, amp) },
    precipitation: { annual_total: precip, monthly: Array.from({ length: 12 }, () => precip / 12) },
    extremes: { heat_stress_days: 0, drought_risk: 0, flood_risk: 0 },
  };
}

const catalog: AnalogCatalog = {
  version: "test",
  catalogYear: 2025,
  scenario: "ssp245",
  candidateCount: 6,
  method: "test",
  source: "test",
  candidates: [
    cand("Cold", 0, 2, 16, 700),
    cand("Cool", 10, 9, 13, 850),
    cand("Temperate", 20, 15, 11, 900),
    cand("Warm", 30, 21, 9, 1100),
    cand("Hot", 40, 27, 7, 500),
    cand("Tropical", 50, 27, 2, 2200),
  ],
};

// location is far from every catalog lat/lng so the self-exclusion never fires.
const location: LocationOption = { name: "Test", lat: 88, lng: 88, country: "XX", city: "Test" };

function snapshot(baseT: number, amp: number, precip: number) {
  return {
    monthlyTemps: seasonal(baseT, amp),
    monthlyPrecip: Array.from({ length: 12 }, () => precip / 12),
    avgTemp: baseT,
    annualPrecip: precip,
    heatDays: 0,
    drought: 0,
    flood: 0,
  };
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// 1. Close to "Temperate" (tiny offset) -> that city, in-band sigma, has an analog.
const near = findClimateAnalog(catalog, location, 2100, snapshot(15.3, 11.1, 905));
assert(near !== null, "near: expected a match");
console.log(`near  -> ${near!.candidate.name}  sigma=${near!.sigma.toFixed(2)}  dof=${near!.sigmaDof.toFixed(1)}  label=${near!.matchLabel}  noAnalog=${near!.noAnalog}`);
assert(near!.candidate.name === "Temperate", `near: expected Temperate, got ${near!.candidate.name}`);
assert(near!.noAnalog === false, "near: should have an analog");
assert(near!.matchLabel !== "none", "near: label should not be none");
assert(Number.isFinite(near!.sigma) && near!.sigma <= 4, `near: sigma should be <=4, got ${near!.sigma}`);

// 2. A climate far hotter than anything in the catalog -> no modern equivalent.
const novel = findClimateAnalog(catalog, location, 2100, snapshot(60, 11, 900));
assert(novel !== null, "novel: expected a (best-effort) match object");
console.log(`novel -> ${novel!.candidate.name}  sigma=${novel!.sigma.toFixed(2)}  dof=${novel!.sigmaDof.toFixed(1)}  label=${novel!.matchLabel}  noAnalog=${novel!.noAnalog}`);
assert(novel!.noAnalog === true, `novel: expected noAnalog=true, got sigma=${novel!.sigma}`);
assert(novel!.matchLabel === "none", "novel: label should be none");
assert(novel!.sigma > 4, `novel: sigma should exceed 4, got ${novel!.sigma}`);

// 3. Sanity: novelty rises with distance.
assert(novel!.sigma > near!.sigma, "novel must be more dissimilar than near");

console.log("✅ smoke-sigma-analog passed");
