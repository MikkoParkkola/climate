import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(repoRoot, "client", "src", "pages", "climate-app.tsx");
const source = fs.readFileSync(appPath, "utf8");
const reportBlock = source.slice(
  source.indexOf("const buildEducationalReportMarkdown"),
  source.indexOf("const downloadEducationalReport"),
);

assert.match(source, /const buildEducationalReportMarkdown = \(\) =>/, "educational report builder exists");
assert.match(source, /# fupit educational climate summary/, "report has a stable Markdown title");
assert.match(source, /## Selected-year snapshot/, "report includes selected-year snapshot");
assert.match(source, /## Trend rates/, "report includes trend rates");
assert.match(source, /## Living-conditions interpretation/, "report includes living-conditions translation");
assert.match(source, /## Annual roadmap/, "report includes annual roadmap section");
assert.match(source, /## Climate twin/, "report includes climate twin section");
assert.match(source, /## Sources and methods/, "report includes source receipt section");
assert.match(source, /d\.sourceTrail/, "report sources are derived from the grounded projection source trail");
assert.match(source, /roadmapItems/, "report uses the annual roadmap already shown in the UI");
assert.match(source, /dailyLifeSignals/, "report uses the visible daily-life interpretation rows");
assert.match(source, /climateAnalog/, "report uses the bounded climate twin when available");
assert.match(source, /Default-policy note: \$\{DEFAULT_SCENARIO_EXPLANATION\}/, "report preserves current-policy scenario explanation");
assert.match(source, /Coastal relevance: \$\{coastalRelevance\?\.label/, "report includes coastal relevance status for sea-level context");
assert.match(source, /no unregistered enrichment layer/, "report forbids unregistered enrichment claims");
assert.match(source, /no safe-city or climate-haven claim/, "report forbids safe-city framing");
assert.match(source, /text\/markdown;charset=utf-8/, "report downloads as Markdown");
assert.match(source, /fupit-educational-summary-/, "report filename is stable and location-specific");
assert.match(source, /Download report/, "projection receipt exposes report download control");
assert.match(source, /Markdown report is an educational summary built from the same visible fields/, "receipt explains report scope");
assert.doesNotMatch(reportBlock, /property recommendation/i, "report must not recommend property decisions");
assert.doesNotMatch(reportBlock, /\bsafe haven\b/i, "report must not use safe-haven framing");

console.log("educational-report smoke passed: Markdown report, source receipts, roadmap, twin, and caveats guarded");
