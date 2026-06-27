import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(repoRoot, "client", "src", "pages", "climate-app.tsx");
const source = fs.readFileSync(appPath, "utf8");

assert.match(source, /const loadScenarioContrast = async/, "scenario contrast loads pathways on demand");
assert.match(source, /for \(const row of SCENARIOS\)/, "scenario contrast covers all supported SSP scenarios");
assert.match(source, /fetchTrajectory\(selectedLocation, row\.id\)/, "scenario contrast reuses the grounded trajectory API for the same location");
assert.match(source, /Scenario contrast · same location/, "result page renders the scenario contrast section");
assert.match(source, /Load pathway contrast/, "scenario contrast is user-triggered, not hidden or automatic");
assert.match(source, /Lower-warming comparison/, "scenario roles explain lower-warming pathway framing");
assert.match(source, /Current-policy-adjacent reference/, "scenario roles explain the default/reference framing");
assert.match(source, /Higher-warming stress case/, "scenario roles explain high-warming stress framing");
assert.match(source, /lower-likelihood stress test/, "scenario roles caveat SSP5-8.5 framing");
assert.match(source, /Local pathway gap/, "scenario contrast gives a concrete local difference");
assert.match(source, /not predictions/, "scenario contrast avoids declaring a scenario as prophecy");
assert.match(source, /not a claim that one pathway is guaranteed/, "scenario contrast caveats the selected local gap");
assert.match(source, /aria-describedby="scenario-contrast-receipt"/, "scenario contrast action links to an accessible method receipt");
assert.match(source, /id="scenario-contrast-receipt"/, "scenario contrast method receipt is rendered near the action");
assert.match(source, /<ReceiptDetails label="method" text="Fetches the same annual checkpoints/, "scenario contrast method receipt describes the grounded endpoint and same-coordinate comparison");
assert.doesNotMatch(source, /title="Fetch the same annual checkpoints/, "scenario contrast method receipt must not regress to hover-only title text");

console.log("scenario contrast smoke passed: same-location pathway comparison, caveats, and accessible method receipt guarded");
