import assert from "node:assert/strict";
import {
  lookupHumidHeat,
  lookupColdSeason,
  lookupDegreeDays,
  nexGddpArtifactSummary,
} from "../server/nex-gddp";

// Grounded NASA NEX-GDDP-CMIP6 smoke: the artifact loads; a hot-humid city resolves wet-bulb
// exceedance days that decrease as the threshold rises; a cold city resolves ETCCDI frost days
// and a sub-zero TNn; degree-days resolve; warmer scenarios are ordered hotter (more cooling
// degree-days, no fewer humid-heat days); out-of-grid latitudes return null, never a guess.

const summary = nexGddpArtifactSummary();
assert.equal(summary.sourceId, "nasa-nex-gddp-cmip6-v1");
assert.equal(summary.license, "cc0-1.0");
assert.equal(summary.resolutionDegrees, 0.25);
assert.deepEqual(summary.scenarios, ["ssp126", "ssp245", "ssp370", "ssp585"]);
assert.ok(summary.attribution.includes("NEX-GDDP") && summary.attribution.includes("Stull"));
assert.ok(Array.isArray(summary.builtWindows) && summary.builtWindows.length >= 1, "at least one window must be built");
assert.ok(summary.wetBulbThresholds.includes(35));
assert.equal(summary.degreeDayBaseC, 18);

// Kolkata: hot, humid -> resolves humid-heat with exceedance days that fall as the threshold rises.
const kolkata = lookupHumidHeat(22.57, 88.36, "ssp585");
assert.ok(kolkata, "Kolkata should resolve humid heat");
assert.ok(kolkata!.horizons.length >= 1, "humid-heat should have >=1 built horizon");
const kh = kolkata!.horizons[kolkata!.horizons.length - 1];
assert.ok(typeof kh.daysAbove28 === "number", "Kolkata daysAbove28 should be numeric");
assert.ok(kh.daysAbove28! >= (kh.daysAbove31 ?? 0), "exceedance days should not increase with a higher threshold");
assert.ok((kh.daysAbove31 ?? 0) >= (kh.daysAbove35 ?? 0), "exceedance days should not increase with a higher threshold");

// All four SSPs resolve for a land point (NEX-GDDP serves all four).
for (const scenario of ["ssp126", "ssp245", "ssp370", "ssp585"]) {
  assert.ok(lookupHumidHeat(22.57, 88.36, scenario), `${scenario} should resolve humid heat for Kolkata`);
}

// Scenario grounding: more warming -> at least as many humid-heat days at a hot place. A small
// tolerance absorbs single-model 5-year-window noise (scenarios diverge little by mid-century)
// while still catching gross errors such as an inverted scenario map.
const lastWindow = kolkata!.horizons[kolkata!.horizons.length - 1].window;
const daysAt = (s: string) =>
  lookupHumidHeat(22.57, 88.36, s)!.horizons.find((h) => h.window === lastWindow)!.daysAbove28!;
assert.ok(daysAt("ssp585") >= daysAt("ssp126") - 3, `SSP5-8.5 humid-heat days (${daysAt("ssp585")}) should be >= SSP1-2.6 (${daysAt("ssp126")}) within tolerance`);

// Yakutsk: deep-cold continental -> resolves ETCCDI cold indices with frost days and sub-zero TNn.
const yakutsk = lookupColdSeason(62.03, 129.73, "ssp245");
assert.ok(yakutsk, "Yakutsk should resolve cold season");
const yc = yakutsk!.horizons[yakutsk!.horizons.length - 1];
assert.ok(typeof yc.frostDays === "number" && yc.frostDays! > 0, "Yakutsk should have frost days");
assert.ok(typeof yc.minTasminC === "number" && yc.minTasminC! < 0, `Yakutsk TNn should be sub-zero, got ${yc.minTasminC}`);

// Degree-days resolve; cooling degree-days rise with warming at a warm place.
const dd = lookupDegreeDays(22.57, 88.36, "ssp585");
assert.ok(dd, "Kolkata should resolve degree-days");
const ddh = dd!.horizons[dd!.horizons.length - 1];
assert.ok(typeof ddh.coolingDegreeDays === "number" && ddh.coolingDegreeDays! > 0, "Kolkata should have cooling degree-days");
assert.ok(typeof ddh.heatingDegreeDays === "number" && ddh.heatingDegreeDays! >= 0, "heating degree-days should be defined");
const cddAt = (s: string) =>
  lookupDegreeDays(22.57, 88.36, s)!.horizons.find((h) => h.window === ddh.window)!.coolingDegreeDays!;
assert.ok(cddAt("ssp585") >= cddAt("ssp126") - 50, `SSP5-8.5 cooling degree-days (${cddAt("ssp585")}) should be >= SSP1-2.6 (${cddAt("ssp126")}) within tolerance`);

// Out-of-grid latitude -> null, never a fabricated value.
assert.equal(lookupHumidHeat(95, 0, "ssp585"), null);
assert.equal(lookupColdSeason(95, 0, "ssp585"), null);
assert.equal(lookupDegreeDays(95, 0, "ssp585"), null);

console.log("nex-gddp smoke passed");
