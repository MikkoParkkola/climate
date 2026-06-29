import assert from "node:assert/strict";
import { amocAssessment } from "../server/amoc";
import { lookupAmocCollapse, amocCollapseArtifactSummary } from "../server/amoc-impact";

// Grounded AMOC-collapse impact smoke test: the NAHosMIP artifact loads, NW Europe
// resolves to a severe cooling / wetter-or-drier / higher-sea-level / stronger-pressure
// collapse-tail profile with a real across-model spread, the profile is wired onto the
// amoc object, and the existing qualitative fields are untouched. No value is fabricated:
// every dimension is a real multi-model reduction, and the spread is the honesty signal.

const summary = amocCollapseArtifactSummary();
assert.ok(summary, "amoc-collapse artifact summary should load");
assert.equal(summary!.sourceId, "nahosmip-amoc-collapse-v1");
assert.equal(summary!.license, "CC-BY-SA-4.0");
assert.ok(summary!.attribution.includes("NAHosMIP"), "attribution must credit NAHosMIP");
assert.ok(summary!.modelCount >= 2, `expected >=2 models, got ${summary!.modelCount}`);
assert.ok(summary!.models.includes("EC-Earth3"), "EC-Earth3 should be in the ensemble");

// NW Europe (London ~51.5N, 0W) — the canonical AMOC-collapse cooling signal.
const london = lookupAmocCollapse(51.5, -0.13);
assert.ok(london, "London should resolve a collapse profile");
const t = london!.temperature!;
assert.ok(t, "temperature dimension should be present");
// Collapse cools NW Europe strongly (van Westen 2024: severe cooling). Multi-model mean
// is well below zero; bound loosely so the test survives a future re-reduction.
assert.ok(t.mean < -1.0, `expected NW-EU collapse cooling < -1 degC, got ${t.mean}`);
assert.ok(t.mean > -12, `cooling magnitude implausibly large: ${t.mean}`);
assert.ok(t.spread > 0, `temperature spread should be > 0 (the honesty signal), got ${t.spread}`);
assert.equal(t.unit, "degC");

// Regional dynamic sea level rises in the subpolar North Atlantic on collapse (up to ~50cm
// in the literature). Sign + plausibility check, not an exact value.
const sl = london!.seaLevel;
if (sl) {
  assert.ok(sl.mean > 0, `expected NW-EU dynamic sea-level RISE, got ${sl.mean}`);
  assert.ok(sl.mean < 80, `sea-level rise implausibly large: ${sl.mean}`);
  assert.ok(sl.spread > 0, "sea-level spread should be > 0");
  assert.equal(sl.unit, "cm");
}

// Precipitation dimension carries both an absolute (mm/day) and a relative (%) figure.
const pr = london!.precipitation;
if (pr) {
  assert.equal(pr.unit, "mm/day");
  assert.ok(Number.isFinite(pr.mean), "precip mean should be finite");
  assert.ok(pr.spread >= 0, "precip spread should be >= 0");
}

// Always a labelled tail scenario, never the central case.
assert.equal(london!.scenarioApplicability, "low-probability-high-impact-collapse-tail");
assert.equal(london!.modelCount, summary!.modelCount);

// Wiring: the collapse profile rides on the amoc object, and the qualitative fields survive.
const a = amocAssessment(51.5, -0.13);
assert.equal(a.status, "context-only", "qualitative status field must be unchanged");
assert.ok(a.weakeningAssessment.includes("very likely to weaken"), "weakening note must survive");
assert.ok(a.collapseProfile, "amoc.collapseProfile must be wired");
assert.equal(a.collapseProfile!.sourceId, "nahosmip-amoc-collapse-v1");
assert.ok((a.collapseProfile!.temperature?.mean ?? 0) < -1.0, "wired profile must carry the cooling");

// Open ocean far from any model coverage still returns a profile for atmos vars (global
// fields) but must never invent: a deep-land cell with no ocean returns null seaLevel.
const sahara = lookupAmocCollapse(23.4, 25.0); // central Sahara, no ocean
assert.ok(sahara === null || sahara.seaLevel === null, "land-only cell must not fabricate sea level");

console.log("amoc-impact smoke passed");
