import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { climateTwinQuerySchema, findClimateTwin, loadClimateAnalogCatalog } from "../server/climate-twin";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pythonBin = process.env.PYTHON_BIN || "python3";

function runModel(lat: number, lng: number, year: number, scenario: string) {
  const result = spawnSync(
    pythonBin,
    ["grounded_model.py", String(lat), String(lng), String(year), scenario],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

const catalog = loadClimateAnalogCatalog();
assert.equal(catalog.version, "grounded-current-analogs-v1");
assert.equal(catalog.candidates.length, catalog.candidateCount);

const invalidScenario = climateTwinQuerySchema.safeParse({
  lat: "60.17",
  lng: "24.94",
  year: "2050",
  scenario: "ssp119",
});
assert.equal(invalidScenario.success, false);

const currentHelsinki = runModel(60.17, 24.94, catalog.catalogYear, catalog.scenario);
const currentTwin = findClimateTwin({
  catalog,
  projection: currentHelsinki,
  lat: 60.17,
  lng: 24.94,
  year: catalog.catalogYear,
  scenario: catalog.scenario,
  limit: 3,
});
assert.ok(currentTwin);
assert.equal(currentTwin.match?.candidate.name, "Helsinki");
assert.equal(currentTwin.noCloseAnalog, false);
assert.ok(currentTwin.sourceReceipt.sourceIds.includes("curated-ranking-cities-v1"));
assert.ok(currentTwin.sourceReceipt.sourceIds.includes("cmip6-etccdi"));

const futureHelsinki = runModel(60.17, 24.94, 2050, "ssp245");
const futureTwin = findClimateTwin({
  catalog,
  projection: futureHelsinki,
  lat: 60.17,
  lng: 24.94,
  year: 2050,
  scenario: "ssp245",
  limit: 5,
});
assert.ok(futureTwin);
assert.notEqual(futureTwin.match?.candidate.name, "Helsinki");
assert.equal(futureTwin.catalog.comparedCount, catalog.candidateCount - 1);
assert.equal(futureTwin.alternatives.length, 5);
assert.ok(Number.isFinite(futureTwin.match?.distance));
assert.ok(Number.isFinite(futureTwin.match?.distanceComponents.monthlyTemperature));
assert.ok(Number.isFinite(futureTwin.match?.distanceComponents.monthlyPrecipitation));
assert.ok(Number.isFinite(futureTwin.match?.deltas.annualTemperatureC));
assert.ok(futureTwin.distanceReference.p50NearestNeighbor > 0);

console.log("climate twin smoke passed");
