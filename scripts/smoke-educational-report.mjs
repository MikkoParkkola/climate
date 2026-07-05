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
const reportBlock = source.slice(
  source.indexOf("const buildEducationalReportMarkdown"),
  source.indexOf("const downloadEducationalReport"),
);

assert.match(all, /const buildEducationalReportMarkdown = \(\) =>/, "educational report builder exists");
assert.match(all, /# fupit educational climate summary/, "report has a stable Markdown title");
assert.match(all, /## Selected-year snapshot/, "report includes selected-year snapshot");
assert.match(all, /## Trend rates/, "report includes trend rates");
assert.match(all, /## Living-conditions interpretation/, "report includes living-conditions translation");
assert.match(all, /## Annual roadmap/, "report includes annual roadmap section");
assert.match(all, /## Climate twin/, "report includes climate twin section");
assert.match(all, /## Sources and methods/, "report includes source receipt section");
assert.match(all, /d\.sourceTrail/, "report sources are derived from the grounded projection source trail");
assert.match(all, /roadmapItems/, "report uses the annual roadmap already shown in the UI");
assert.match(all, /dailyLifeSignals/, "report uses the visible daily-life interpretation rows");
assert.match(all, /climateAnalog/, "report uses the bounded climate twin when available");
assert.match(all, /Default-policy note: \$\{DEFAULT_SCENARIO_EXPLANATION\}/, "report preserves current-policy scenario explanation");
assert.match(all, /Coastal relevance: \$\{coastalRelevance\?\.label/, "report includes coastal relevance status for sea-level context");
assert.match(all, /Cold-season context: \$\{d\.coldMonthCount\} monthly-mean freeze months/, "report includes cold-season monthly-mean context");
assert.match(all, /not daily freeze days or a daily cold-stress count/, "report caveats cold-season context as non-daily");
assert.match(all, /no unregistered enrichment layer/, "report forbids unregistered enrichment claims");
assert.match(all, /no safe-city or climate-haven claim/, "report forbids safe-city framing");
assert.match(all, /text\/markdown;charset=utf-8/, "report downloads as Markdown");
assert.match(all, /fupit-educational-summary-/, "report filename is stable and location-specific");
assert.match(all, /Download report/, "projection receipt exposes report download control");
assert.match(all, /Markdown report is an educational summary built from the same visible fields/, "receipt explains report scope");
assert.doesNotMatch(reportBlock, /property recommendation/i, "report must not recommend property decisions");
assert.doesNotMatch(reportBlock, /\bsafe haven\b/i, "report must not use safe-haven framing");

console.log("educational-report smoke passed: Markdown report, source receipts, roadmap, twin, and caveats guarded");
