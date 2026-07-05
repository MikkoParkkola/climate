import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(repoRoot, "client", "src", "pages", "climate-app.tsx");
const source = fs.readFileSync(appPath, "utf8");
const helpers = fs.readFileSync(path.join(repoRoot, "client", "src", "lib", "climate-helpers.ts"), "utf8");
const charts = fs.readFileSync(path.join(repoRoot, "client", "src", "components", "climate-charts.tsx"), "utf8");
const shareCard = fs.readFileSync(path.join(repoRoot, "client", "src", "lib", "share-card.ts"), "utf8");
const constants = fs.readFileSync(path.join(repoRoot, "client", "src", "lib", "climate-constants.ts"), "utf8");
const types = fs.readFileSync(path.join(repoRoot, "client", "src", "lib", "climate-types.ts"), "utf8");
const derivations = fs.readFileSync(path.join(repoRoot, "client", "src", "lib", "climate-derivations.ts"), "utf8");
const landing = fs.readFileSync(path.join(repoRoot, "client", "src", "components", "climate-landing.tsx"), "utf8");
const hook = fs.readFileSync(path.join(repoRoot, "client", "src", "hooks", "use-climate-app.ts"), "utf8");
const resultView = fs.readFileSync(path.join(repoRoot, "client", "src", "components", "climate-result-view.tsx"), "utf8");
const sectionsTop = fs.readFileSync(path.join(repoRoot, "client", "src", "components", "climate-result-sections-top.tsx"), "utf8");
const sectionsBottom = fs.readFileSync(path.join(repoRoot, "client", "src", "components", "climate-result-sections-bottom.tsx"), "utf8");
const all = [source, helpers, charts, shareCard, constants, types, derivations, landing, hook, resultView, sectionsTop, sectionsBottom].join("\n");

assert.match(all, /schema:\s*"fupit\.forecast\.raw\.v1"/, "raw JSON export has a versioned schema");
assert.match(all, /Copy raw JSON/, "projection receipt exposes a raw JSON copy control");
assert.match(all, /Download JSON/, "projection receipt exposes a raw JSON download control");
assert.match(all, /selected_point:\s*d\.np/, "raw JSON export includes the selected-year projection point");
assert.match(all, /\btrajectory,\s*\}/, "raw JSON export includes the full trajectory returned by the API");
assert.match(all, /model:\s*\{[\s\S]*?version:\s*d\.modelVersion[\s\S]*?confidence:\s*d\.confidence/s, "raw JSON export includes model metadata");
assert.match(all, /uncertainty fields, and source trail/, "receipt explains that raw JSON includes uncertainty and source trail fields");

console.log("raw JSON export smoke passed: controls and payload fields guarded");
