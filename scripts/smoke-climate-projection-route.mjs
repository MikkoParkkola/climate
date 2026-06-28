import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routesPath = path.join(repoRoot, "server", "routes.ts");
const source = fs.readFileSync(routesPath, "utf8");

// Forecasts run only through the in-process Node grid engine. The legacy Python
// serving subprocess has been removed, so the live request path must not spawn
// a child process at all.
assert.match(
  source,
  /import \{ climateTrajectory, projectClimate \} from "\.\/grounded-node-model";/,
  "routes import the in-process Node grid engine",
);
assert.equal(
  source.includes('spawn(PYTHON_BIN'),
  false,
  "no Python subprocess is spawned in the serving path",
);
assert.equal(
  source.includes('from "child_process"'),
  false,
  "child_process is no longer imported by the serving path",
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

const activeBranch = routeBlock.slice(runModelIndex);
assert.match(
  activeBranch,
  /return\s+res\.json\(\{\s*success:\s*true,\s*data:\s*result\s*\}\)/,
  "climate-projection keeps its success envelope after running the Node engine",
);

console.log("climate-projection route smoke passed: Node-only engine, no Python spawn, scenario validation, success envelope guarded");
