import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(repoRoot, "client", "src", "pages", "climate-app.tsx");
const source = fs.readFileSync(appPath, "utf8");

assert.match(source, /const scoreStory = useMemo/, "storyline derives score-story data from the selected trajectory");
assert.match(source, /baseline\.habitability\.breakdown/, "storyline compares selected score components to the baseline breakdown");
assert.match(source, /componentScoreEffect/, "storyline adjusts contribution and penalty signs before ranking score drivers");
assert.match(source, /scoreDrivers[\s\S]*?sort\(\(a, b\) => Math\.abs\(b\.effect\) - Math\.abs\(a\.effect\)\)/, "storyline ranks drivers by absolute score effect");
assert.match(source, /Math\.abs\(driver\.effect\) >= 0\.05/, "storyline filters out near-zero driver movement before ranking");
assert.match(source, /perDecade/, "storyline exposes per-decade trend rates, not only endpoint deltas");
assert.match(source, /Why this changed/, "result page renders the required why-this-changed section");
assert.match(source, /What this means for daily life/, "result page renders the required daily-life interpretation section");
assert.match(source, /not a full causal attribution model/, "driver ranking caveats the attribution boundary");
assert.match(source, /function ReceiptDetails\(/, "result page centralizes receipt disclosures in an accessible component");
assert.match(source, /aria-label=\{`\$\{label\}: \$\{text\}`\}/, "receipt disclosure summaries expose their full text to assistive tech");
assert.match(source, /role="note"/, "expanded receipt disclosures are announced as notes");
assert.match(source, /<ReceiptDetails label="source" text=\{signal\.receipt\} \/>/, "daily-life rows expose keyboard and touch accessible source receipts");
assert.doesNotMatch(source, /title=\{signal\.receipt\}/, "daily-life source receipts must not regress to hover-only title text");
assert.match(source, /Not yet included in the score/, "storyline discloses important missing impact domains");

console.log("storyline smoke passed: explainability sections, trend rates, and accessible receipts guarded");
