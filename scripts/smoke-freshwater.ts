import assert from "node:assert/strict";
import { lookupFreshwater, freshwaterArtifactSummary } from "../server/freshwater";

// Grounded Freshwater (WRI Aqueduct 4.0) smoke test: the artifact loads, known arid
// cities resolve to high water stress, an unsupported scenario (ssp245) and open ocean
// return null (never a fabricated value), and year requests clamp to Aqueduct horizons.

const summary = freshwaterArtifactSummary();
assert.equal(summary.sourceId, "wri-aqueduct-40-water-stress-v1");
assert.equal(summary.license, "attribution");
assert.ok(summary.attribution.includes("Aqueduct"));
assert.deepEqual(summary.years, [2030, 2050, 2080]);
assert.ok(summary.basinCount > 10000, `expected >10000 basins, got ${summary.basinCount}`);

// Arid / high-stress cities -> a category, high for pessimistic mid-century.
for (const [name, lat, lng] of [
  ["Phoenix", 33.45, -112.07],
  ["Riyadh", 24.71, 46.68],
  ["Cairo", 30.04, 31.24],
] as const) {
  const fw = lookupFreshwater(lat, lng, "ssp585");
  assert.ok(fw, `${name} should resolve a sub-basin`);
  assert.equal(fw!.scenario, "ssp585");
  assert.equal(fw!.aqueductScenario, "pes");
  assert.equal(fw!.horizons.length, 3);
  const mid = fw!.horizons.find((h) => h.year === 2050)!;
  assert.ok(typeof mid.category === "number", `${name} 2050 category should be numeric`);
  assert.ok(mid.label && mid.label.length > 0, `${name} 2050 label should be present`);
  assert.ok((mid.category ?? -99) >= 3, `${name} expected high/extremely-high water stress, got ${mid.label}`);
}

// A coastal city recovered via the nearest-basin fallback still returns a category.
const helsinki = lookupFreshwater(60.17, 24.94, "ssp370");
assert.ok(helsinki, "Helsinki should resolve via nearest-basin fallback");
assert.equal(helsinki!.aqueductScenario, "bau");

// Scenario mapping: ssp126 -> opt, ssp370 -> bau, ssp585 -> pes.
assert.equal(lookupFreshwater(33.45, -112.07, "ssp126")!.aqueductScenario, "opt");
assert.equal(lookupFreshwater(33.45, -112.07, "ssp370")!.aqueductScenario, "bau");

// Unsupported scenario (ssp245 has no Aqueduct match) -> null, not a guess.
assert.equal(lookupFreshwater(33.45, -112.07, "ssp245"), null);

// Open ocean -> no classified sub-basin -> null, not a guess.
assert.equal(lookupFreshwater(0, -150, "ssp585"), null);

// Years beyond 2080 clamp to the latest available Aqueduct horizon (no extrapolation).
const clamp = lookupFreshwater(24.71, 46.68, "ssp585");
assert.ok(clamp!.horizons.every((h) => [2030, 2050, 2080].includes(h.year)));

console.log("freshwater smoke passed");
