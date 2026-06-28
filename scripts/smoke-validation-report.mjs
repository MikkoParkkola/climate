#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const audit = JSON.parse(readFileSync(path.join(repoRoot, "data", "trajectory-audit-summary.json"), "utf8"));
const observedBaselineAudit = JSON.parse(readFileSync(path.join(repoRoot, "data", "observed-baseline-audit.json"), "utf8"));
const observedClimatologyValidation = JSON.parse(readFileSync(path.join(repoRoot, "data", "observed-climatology-validation.nasa-power.json"), "utf8"));
const report = readFileSync(path.join(repoRoot, "docs", "VALIDATION_REPORT.md"), "utf8");

assert.match(report, /# fupit Validation Report/, "validation report title is present");
assert.ok(report.includes(audit.generatedAt), "validation report cites the exact audit artifact timestamp");
assert.ok(report.includes(observedBaselineAudit.generatedAt), "validation report cites the exact observed baseline audit timestamp");
assert.ok(report.includes(observedClimatologyValidation.generatedAt), "validation report cites the exact NASA POWER validation timestamp");
assert.match(report, new RegExp(`Scenario-place results: ${audit.resultCount}`), "validation report cites audit matrix size");
assert.match(report, /Observed Baseline Cross-check/, "validation report includes observed baseline cross-check section");
assert.match(report, new RegExp(`Fixture cities: ${observedBaselineAudit.cityCount}`), "validation report cites observed baseline matrix size");
assert.match(report, /NASA POWER \/ MERRA-2 observed climatology/, "validation report includes external observed climatology section");
assert.match(report, new RegExp(`Fixture cities: ${observedClimatologyValidation.cityCount}`), "validation report cites NASA POWER matrix size");
assert.match(report, /not a correction layer and not proof of future projection skill/, "validation report prevents overclaiming NASA POWER validation");
assert.match(report, /source year is 2030/, "validation report discloses near-current source-year basis");
assert.match(report, /Not a Historical Hindcast/, "validation report must disclose that true projection hindcast is still missing");
assert.match(report, /must not claim historical forecast skill/, "validation report prevents overclaiming hindcast skill");
assert.match(report, /Trend review flags are unresolved scientific-review evidence/, "validation report keeps trend flags unresolved");
assert.match(report, /\| ssp370 \| Mumbai \| precipStep=/, "validation report includes the Mumbai precipitation-step review item");
assert.match(report, /Smoothing without a grounded method would be another form of fabricated science/, "validation report forbids ungrounded smoothing");

console.log("validation-report smoke passed");
