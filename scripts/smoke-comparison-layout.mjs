import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const comparisonPath = path.join(repoRoot, "client", "src", "pages", "climate-comparison.tsx");
const source = fs.readFileSync(comparisonPath, "utf8");

const sliderComment = "{/* Sticky Year Slider */}";
const sliderStart = source.indexOf(sliderComment);
assert.notEqual(sliderStart, -1, "comparison page contains the sticky year slider");

const sliderBlock = source.slice(sliderStart, sliderStart + 600);
assert.match(sliderBlock, /position:\s*"sticky"/, "comparison year slider remains sticky");
assert.match(sliderBlock, /top:\s*0\b/, "comparison year slider sticks to viewport top, not below a missing header");
assert.doesNotMatch(sliderBlock, /top:\s*"48px"|top:\s*48\b/, "comparison year slider must not reuse the single-location header offset");
assert.match(sliderBlock, /zIndex:\s*45\b/, "comparison year slider stays above result content while below app modals");

const scenarioControlStart = source.indexOf('id="comparison-scenario"');
assert.notEqual(scenarioControlStart, -1, "comparison page exposes a scenario selector");
const scenarioControlBlock = source.slice(scenarioControlStart, scenarioControlStart + 900);
assert.match(scenarioControlBlock, /value=\{scenario\}/, "comparison scenario selector is bound to scenario state");
assert.match(scenarioControlBlock, /changeScenario\(parseScenario\(e\.target\.value\)\)/, "comparison scenario selector updates scenario state");
assert.match(source, /setTrajectories\(\[\]\);/, "comparison scenario changes clear stale trajectory results");
assert.match(source, /body:\s*JSON\.stringify\(\{[\s\S]*?years:\s*CHECKPOINTS,[\s\S]*?scenario,[\s\S]*?\}\)/, "comparison trajectory requests include the selected scenario");

console.log("comparison layout smoke passed: slider offset and scenario selector guarded");
