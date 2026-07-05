import assert from "node:assert/strict";
import { lookupCropYield, cropYieldArtifactSummary } from "../server/crops";

// Grounded crop-yield (ISIMIP3b GGCMI phase 3) smoke test: the artifact loads, major
// crop regions resolve to yield-change percentages, the warming scenarios are ordered
// (more warming -> larger maize loss in the temperate breadbaskets), ocean/desert cells
// and the unmapped scenario (ssp245) return null, never a fabricated value.

const summary = cropYieldArtifactSummary();
assert.equal(summary.sourceId, "isimip-ggcmi-phase3-yield-v1");
assert.equal(summary.license, "cc0-1.0");
assert.ok(summary.attribution.includes("ISIMIP"), "attribution should cite ISIMIP");
assert.deepEqual(summary.years, [2030, 2050, 2080]);
assert.equal(summary.resolutionDegrees, 0.5);
assert.equal(summary.baselinePeriod, "2015-2034");
for (const c of ["mai", "soy", "ri1", "wwh"]) {
  assert.ok(summary.crops[c], `crop ${c} should be present`);
}

// US Corn Belt -> resolves, with a numeric maize yield change that drops under high warming.
const iowa = lookupCropYield(42.0, -93.5, "ssp585");
assert.ok(iowa, "Iowa should resolve crop yields");
assert.equal(iowa!.scenario, "ssp585");
const iowaMaize = iowa!.crops.find((c) => c.crop === "mai");
assert.ok(iowaMaize, "Iowa should have a maize series");
const iowaMaize2080 = iowaMaize!.horizons.find((h) => h.year === 2080)!;
assert.ok(typeof iowaMaize2080.yieldChangePercent === "number", "Iowa maize 2080 should be numeric");
assert.ok(iowaMaize2080.yieldChangePercent! < 0, `Iowa maize should decline under SSP5-8.5, got ${iowaMaize2080.yieldChangePercent}`);

// Scenario grounding: high warming should hurt Corn Belt maize at least as much as low warming.
const maize2080 = (scenario: string) =>
  lookupCropYield(42.0, -93.5, scenario)!.crops.find((c) => c.crop === "mai")!.horizons.find((h) => h.year === 2080)!.yieldChangePercent!;
assert.ok(maize2080("ssp585") <= maize2080("ssp126"), `SSP5-8.5 maize (${maize2080("ssp585")}) should be <= SSP1-2.6 (${maize2080("ssp126")})`);

// All three supported scenarios resolve for a breadbasket.
for (const scenario of ["ssp126", "ssp370", "ssp585"]) {
  assert.ok(lookupCropYield(42.0, -93.5, scenario), `${scenario} should resolve for Iowa`);
}

// Unmapped scenario (ssp245 not in GGCMI3b core protocol) -> null, not a guess.
assert.equal(lookupCropYield(42.0, -93.5, "ssp245"), null);

// Open ocean -> no staple crop grown -> null, not a guess.
assert.equal(lookupCropYield(0, -150, "ssp585"), null);

console.log("crops smoke passed");
