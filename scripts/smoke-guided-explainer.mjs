import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(repoRoot, "client", "src", "pages", "climate-app.tsx");
const componentPath = path.join(repoRoot, "client", "src", "components", "guided-climate-explainer.tsx");

const appSource = fs.readFileSync(appPath, "utf8");
const componentSource = fs.readFileSync(componentPath, "utf8");

assert.match(appSource, /import GuidedClimateExplainer from "@\/components\/guided-climate-explainer"/, "ClimateApp imports guided explainer");
assert.match(appSource, /<GuidedClimateExplainer/, "ClimateApp renders guided explainer");
assert.match(appSource, /dailyLifeSignals=\{dailyLifeSignals\}/, "explainer uses visible daily-life signal rows");
assert.match(appSource, /roadmapItems=\{roadmapItems\}/, "explainer uses existing roadmap rows");
assert.match(appSource, /scenarioContrastText=\{scenarioContrastTakeaway\?\.text \?\? null\}/, "explainer uses existing scenario contrast text");
assert.match(appSource, /sourceCount=\{d!\.sourceTrail\.length\}/, "explainer exposes source-trail evidence count");
assert.match(appSource, /climateTwin=\{climateAnalog \? \{/, "explainer uses bounded climate twin when available");

assert.match(componentSource, /Guided explainer/, "component has stable guided-explainer heading");
assert.match(componentSource, /classroom-friendly reading path/, "component is framed for education");
assert.match(componentSource, /Every statement below is derived from the visible forecast fields/, "component discloses derivation boundary");
assert.match(componentSource, /Read the trend before the snapshot/, "component guides trend-first reading");
assert.match(componentSource, /Translate it into daily life questions/, "component translates metrics into daily-life questions");
assert.match(componentSource, /Ask what is driving the score/, "component explains score drivers");
assert.match(componentSource, /Compare pathways and analogs/, "component includes scenario/twin learning step");
assert.match(componentSource, /Inspect the evidence and limits/, "component points users to evidence and limits");
assert.match(componentSource, /Classroom prompts/, "component includes classroom prompts");
assert.match(componentSource, /does not add unregistered freshwater, crop, biodiversity, wildfire, insurance, medical, engineering, or safe-haven claims/, "component suppresses unregistered enrichment and safe-haven claims");
assert.doesNotMatch(componentSource, /fetch\(/, "component must not fetch or create another data path");
assert.doesNotMatch(componentSource, /property-risk certificate|relocation recommendation|insurance model/i, "component must not become an advice surface");

console.log("guided-explainer smoke passed: component wiring, trend-first prompts, grounded inputs, and caveats guarded");
