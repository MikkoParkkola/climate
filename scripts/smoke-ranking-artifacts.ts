import assert from "node:assert/strict";
import { getRanking } from "../server/precomputed-rankings";
import { loadSourceRegistry } from "../server/source-registry";

const registry = loadSourceRegistry();
assert.equal(registry.version, "source-registry-v1");
assert.ok(registry.rows.some((row) => row.sourceId === "cmip6-scenariomip"));

const habitability = getRanking({
  year: 2050,
  scenario: "ssp245",
  catalog: "curated_cities",
  metric: "habitability_score",
  direction: "highest",
  limit: 10,
});
assert.ok(habitability);
assert.equal(habitability.rows.length, 10);
assert.ok(habitability.sourceIds.every((sourceId) => registry.rows.some((row) => row.sourceId === sourceId)));
assert.ok(habitability.caveats.some((caveat) => caveat.includes("not complete global rankings")));

const unsupportedExtreme = getRanking({
  year: 2050,
  scenario: "ssp119",
  catalog: "curated_cities",
  metric: "heat_stress_days",
  direction: "highest",
  limit: 10,
});
assert.equal(unsupportedExtreme, undefined);

console.log("ranking artifact smoke passed");
