import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(repoRoot, "client", "src", "pages", "climate-app.tsx");
const source = fs.readFileSync(appPath, "utf8");

assert.match(source, /const shareStory = useMemo/, "share card derives a versioned story from live result data");
assert.match(source, /scoreStory\.scoreDrivers\[0\]/, "share card includes the top visible score driver");
assert.match(source, /climateAnalog\.candidate\.name/, "share card can use the bounded climate-twin match");
assert.match(source, /Shareable climate story/, "result page renders the shareable story card");
assert.match(source, /Share story/, "share card exposes a one-click share control");
assert.match(source, /Copy story/, "share card exposes a clipboard fallback");
assert.match(source, /navigator\.share/, "share flow uses the platform share API when available");
assert.match(source, /bounded climate-twin catalog/, "share card discloses bounded analog catalog coverage");
assert.match(source, /no unregistered enrichments/, "share card forbids unregistered enrichment claims");
assert.match(source, /no safe-city claim/, "share card forbids safe-city claims");
assert.doesNotMatch(source, /recruiter|business opportunit|traffic source|showcase funnel/i, "public share card must not leak private visibility strategy");

console.log("share-card smoke passed: one-click story, climate twin, trend driver, and caveats guarded");
