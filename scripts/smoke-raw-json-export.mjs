import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(repoRoot, "client", "src", "pages", "climate-app.tsx");
const source = fs.readFileSync(appPath, "utf8");

assert.match(source, /schema:\s*"fupit\.forecast\.raw\.v1"/, "raw JSON export has a versioned schema");
assert.match(source, /Copy raw JSON/, "projection receipt exposes a raw JSON copy control");
assert.match(source, /Download JSON/, "projection receipt exposes a raw JSON download control");
assert.match(source, /selected_point:\s*d\.np/, "raw JSON export includes the selected-year projection point");
assert.match(source, /\btrajectory,\s*\}/, "raw JSON export includes the full trajectory returned by the API");
assert.match(source, /model:\s*\{[\s\S]*?version:\s*d\.modelVersion[\s\S]*?confidence:\s*d\.confidence/s, "raw JSON export includes model metadata");
assert.match(source, /uncertainty fields, and source trail/, "receipt explains that raw JSON includes uncertainty and source trail fields");

console.log("raw JSON export smoke passed: controls and payload fields guarded");
