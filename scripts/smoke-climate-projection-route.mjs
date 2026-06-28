import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routesPath = path.join(repoRoot, "server", "routes.ts");
const gridEnginePath = path.join(repoRoot, "server", "climate-grid-engine.ts");
const source = fs.readFileSync(routesPath, "utf8");
const gridEngineSource = fs.readFileSync(gridEnginePath, "utf8");

assert.match(
  gridEngineSource,
  /return\s+"node";/,
  "CLIMATE_GRID_ENGINE defaults to the in-process Node grid engine",
);
assert.match(
  gridEngineSource,
  /requested === "node" \|\| requested === "python"/,
  "CLIMATE_GRID_ENGINE still allows explicit node/python selection",
);

const routeStart = source.indexOf('app.post("/api/climate-projection"');
assert.notEqual(routeStart, -1, "compatibility climate-projection route exists");

const nextRouteStart = source.indexOf("// POST /api/climate-trajectory", routeStart);
assert.notEqual(nextRouteStart, -1, "climate-projection route is followed by climate-trajectory route");

const routeBlock = source.slice(routeStart, nextRouteStart);
assert.match(
  routeBlock,
  /scenario:\s*z\.enum\(CLIMATE_SCENARIOS\)\.default\(DEFAULT_CLIMATE_SCENARIO\)/,
  "climate-projection route accepts the same supported scenario set as trajectory",
);

const runModelIndex = routeBlock.indexOf("await runClimateModel(");
assert.notEqual(runModelIndex, -1, "climate-projection route calls the shared grounded engine wrapper");

const legacyBusyCheckIndex = routeBlock.indexOf("activePythonProcesses >= MAX_PYTHON_CONCURRENT");
assert.equal(legacyBusyCheckIndex, -1, "climate-projection route no longer bypasses the Python queue with a busy precheck");

const legacyCounterIndex = routeBlock.indexOf("activePythonProcesses++");
if (legacyCounterIndex !== -1) {
  assert.ok(
    runModelIndex < legacyCounterIndex,
    "shared grounded engine wrapper is reached before the legacy subprocess branch",
  );
}

const legacySpawnIndex = routeBlock.indexOf("spawn(PYTHON_BIN");
if (legacySpawnIndex !== -1) {
  assert.ok(runModelIndex < legacySpawnIndex, "CLIMATE_GRID_ENGINE route selection precedes any legacy spawn branch");
}

const activeBranch = routeBlock.slice(
  runModelIndex,
  legacyCounterIndex === -1 ? routeBlock.length : legacyCounterIndex,
);
assert.match(
  activeBranch,
  /return\s+res\.json\(\{\s*success:\s*true,\s*data:\s*result\s*\}\)/,
  "climate-projection keeps its success envelope after running the shared engine",
);

console.log("climate-projection route smoke passed: Node default, scenario validation, and engine wrapper guarded");
