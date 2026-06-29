import assert from "node:assert/strict";
import { lookupRiverFlood, floodRiverArtifactSummary } from "../server/floods";

// Grounded riverine flood (WRI Aqueduct Floods v2, 1-in-100-year) smoke test: the artifact
// loads, major river deltas resolve to high flooded-area fractions, drier areas resolve to
// low/zero (a legitimate answer, not null), RCP8.5 (ssp585) is at least as severe as RCP4.5
// (ssp245), and the unmapped scenarios (ssp126/ssp370) return null, never a fabricated value.

const summary = floodRiverArtifactSummary();
assert.equal(summary.sourceId, "wri-aqueduct-floods-riverine-v1");
assert.equal(summary.license, "attribution");
assert.ok(summary.attribution.includes("Aqueduct"), "attribution should cite Aqueduct");
assert.equal(summary.returnPeriod, "1-in-100-year");
assert.deepEqual(summary.years, [2030, 2050, 2080]);
assert.equal(summary.modelCount, 5);
assert.equal(summary.resolutionDegrees, 0.1);

// Major river deltas / floodplains -> substantial flooded-area fraction and a numeric depth.
for (const [name, lat, lng] of [
  ["Dhaka", 23.81, 90.41],
  ["New Orleans", 29.95, -90.07],
] as const) {
  const f = lookupRiverFlood(lat, lng, "ssp585");
  assert.ok(f, `${name} should resolve a flood cell`);
  assert.equal(f!.scenario, "ssp585");
  assert.equal(f!.aqueductScenario, "rcp8p5");
  assert.equal(f!.horizons.length, 3);
  const mid = f!.horizons.find((h) => h.year === 2050)!;
  assert.ok(mid.floodedFraction > 0.1, `${name} should be substantially flooded, got ${mid.floodedFraction}`);
  assert.ok(typeof mid.meanFloodDepth === "number" && mid.meanFloodDepth! > 0, `${name} should have a positive mean flood depth`);
}

// Scenario grounding: RCP8.5 (ssp585) is at least as flood-exposed as RCP4.5 (ssp245) for Dhaka.
const dhaka585 = lookupRiverFlood(23.81, 90.41, "ssp585")!.horizons.find((h) => h.year === 2080)!.floodedFraction;
const dhaka245 = lookupRiverFlood(23.81, 90.41, "ssp245")!.horizons.find((h) => h.year === 2080)!.floodedFraction;
assert.ok(dhaka585 >= dhaka245, `Dhaka ssp585 (${dhaka585}) should be >= ssp245 (${dhaka245})`);

// A dry/no-floodplain point resolves with a legitimate 0% (not null) and a null depth.
const helsinki = lookupRiverFlood(60.17, 24.94, "ssp585");
assert.ok(helsinki, "Helsinki should resolve (dry is a valid answer)");
const hMid = helsinki!.horizons.find((h) => h.year === 2050)!;
assert.equal(hMid.floodedFraction, 0, "Helsinki should be 0% flooded");
assert.equal(hMid.meanFloodDepth, null, "Helsinki flood depth should be null where nothing floods");

// Unmapped scenarios (no Aqueduct RCP) -> null, not a guess.
assert.equal(lookupRiverFlood(23.81, 90.41, "ssp126"), null);
assert.equal(lookupRiverFlood(23.81, 90.41, "ssp370"), null);

console.log("floods smoke passed");
