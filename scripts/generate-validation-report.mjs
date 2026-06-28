#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const auditPath = path.join(repoRoot, "data", "trajectory-audit-summary.json");
const observedBaselineAuditPath = path.join(repoRoot, "data", "observed-baseline-audit.json");
const observedClimatologyValidationPath = path.join(repoRoot, "data", "observed-climatology-validation.nasa-power.json");
const outPath = path.join(repoRoot, "docs", "VALIDATION_REPORT.md");

const audit = JSON.parse(readFileSync(auditPath, "utf8"));
const observedBaselineAudit = existsSync(observedBaselineAuditPath)
  ? JSON.parse(readFileSync(observedBaselineAuditPath, "utf8"))
  : null;
const observedClimatologyValidation = existsSync(observedClimatologyValidationPath)
  ? JSON.parse(readFileSync(observedClimatologyValidationPath, "utf8"))
  : null;

const scenarioLabels = {
  ssp126: "SSP1-2.6 lower-warming full forecast",
  ssp245: "SSP2-4.5 current-policy-adjacent reference",
  ssp370: "SSP3-7.0 high-warming pathway",
  ssp585: "SSP5-8.5 lower-likelihood stress test",
};

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort(([a], [b]) => String(a).localeCompare(String(b)));
}

function flagKind(flag) {
  return String(flag).split("=")[0];
}

function asList(values) {
  return values.length > 0 ? values.join(", ") : "none";
}

function mdCell(value) {
  return String(value).replaceAll("|", "\\|");
}

const reviewByScenario = countBy(audit.trendReview, (item) => item.scenario);
const reviewByFlag = countBy(audit.trendReview.flatMap((item) => item.flags.map(flagKind)), (item) => item);

const rowsByScenario = audit.scenarios.map((scenario) => {
  const count = reviewByScenario.find(([key]) => key === scenario)?.[1] ?? 0;
  return `| ${scenario} | ${scenarioLabels[scenario] ?? scenario} | ${count} |`;
});

const flagRows = reviewByFlag.map(([kind, count]) => `| ${kind} | ${count} |`);
const reviewRows = audit.trendReview.map((item) =>
  `| ${item.scenario} | ${item.name} | ${mdCell(item.flags.join("; "))} |`,
);

const lines = [
  "# fupit Validation Report",
  "",
  "This report is generated from `data/trajectory-audit-summary.json` by `npm run report:validation`.",
  "It is intentionally conservative: it records what the current artifact proves, what it flags for scientific review, and what it still cannot prove.",
  "",
  "## Artifact",
  "",
  `- Audit artifact version: \`${audit.version}\``,
  `- Audit artifact generated at: \`${audit.generatedAt}\``,
  `- Model entry point audited: \`${audit.model ?? "grounded_model.py"}\``,
  `- Forecast year range audited: ${audit.baselineYear}-${audit.maxYear} (${audit.yearCount} annual points)`,
  `- Fixture cities: ${audit.cityCount}`,
  `- Scenarios: ${asList(audit.scenarios)}`,
  `- Scenario-place results: ${audit.resultCount}`,
  `- Required contract paths checked: ${audit.requiredPaths.length}`,
  "",
  "## What This Proves",
  "",
  "- The grounded model emitted the expected JSON contract for every audited fixture city, scenario, and annual point.",
  "- Monthly temperature, calibrated monthly temperature, and monthly precipitation arrays were present with 12 finite values.",
  "- Core values stayed inside broad physical sanity ranges for temperature, precipitation, heat-stress days, drought risk, flood risk, and habitability score.",
  "- Raw CMIP6 and IPCC-calibrated temperature fields were both present in the audited responses.",
  "",
  ...(observedBaselineAudit ? [
    "## Observed Baseline Cross-check",
    "",
    `- Audit artifact version: \`${observedBaselineAudit.version}\``,
    `- Audit artifact generated at: \`${observedBaselineAudit.generatedAt}\``,
    `- Source checked: ${observedBaselineAudit.source}`,
    `- Fixture cities: ${observedBaselineAudit.cityCount}`,
    `- Maximum Python-vs-Node WorldClim annual temperature difference: ${observedBaselineAudit.maxTemperatureDifferenceC} C`,
    `- Maximum Python-vs-Node WorldClim annual precipitation difference: ${observedBaselineAudit.maxPrecipitationDifferenceMm} mm`,
    `- Near-current projection-year basis: requested ${observedBaselineAudit.checkedYear} values disclose that the packed scenario source year is 2030.`,
    "",
    "This cross-check proves that the packaged WorldClim observed baseline is decoded consistently by the Python serving engine and the Node grid reader for the fixture cities. It is baseline provenance evidence, not a claim that the forecast has been historically hindcast against time-varying observations.",
    "",
  ] : []),
  ...(observedClimatologyValidation ? [
    "## NASA POWER / MERRA-2 observed climatology",
    "",
    `- Validation artifact version: \`${observedClimatologyValidation.version}\``,
    `- Validation artifact generated at: \`${observedClimatologyValidation.generatedAt}\``,
    `- Status: \`${observedClimatologyValidation.status}\``,
    `- Fixture cities: ${observedClimatologyValidation.cityCount}`,
    `- Period compared: ${observedClimatologyValidation.period.start}-${observedClimatologyValidation.period.end}`,
    `- Source IDs: ${asList(observedClimatologyValidation.sourceIds)}`,
    `- Max absolute temperature difference: ${observedClimatologyValidation.summary.maxAbsTemperatureDifferenceC} C`,
    `- Mean absolute temperature difference: ${observedClimatologyValidation.summary.meanAbsTemperatureDifferenceC} C`,
    `- Max absolute precipitation difference: ${observedClimatologyValidation.summary.maxAbsPrecipitationDifferenceMm} mm/year`,
    `- Mean absolute precipitation difference: ${observedClimatologyValidation.summary.meanAbsPrecipitationDifferenceMm} mm/year`,
    `- Review flags: ${observedClimatologyValidation.summary.reviewFlagCount}`,
    "",
    "This matrix compares the packaged WorldClim v2.1 observed baseline against NASA POWER monthly point data for `T2M` and `PRECTOTCORR` over the overlapping 1981-2000 period. Monthly precipitation rates are converted from mm/day to annual totals using month-length weighting.",
    "",
    "This is observation-backed baseline evidence, not a correction layer and not proof of future projection skill.",
    "",
    "| Place | WorldClim temp C | NASA POWER temp C | Diff C | WorldClim precip mm | NASA POWER precip mm | Diff mm | Flags |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...observedClimatologyValidation.results.map((item) =>
      `| ${item.name} | ${item.worldClimAnnualMeanTemperatureC} | ${item.nasaPowerAnnualMeanTemperatureC} | ${item.temperatureDifferenceC} | ${item.worldClimAnnualPrecipitationMm} | ${item.nasaPowerAnnualPrecipitationMm} | ${item.precipitationDifferenceMm} | ${item.flags.length ? mdCell(item.flags.join("; ")) : "none"} |`,
    ),
    "",
    "Caveats:",
    "",
    ...observedClimatologyValidation.caveats.map((caveat) => `- ${caveat}`),
    "",
  ] : []),
  "## Not a Historical Hindcast",
  "",
  "This is not yet a historical future-projection hindcast report. The current artifacts audit forecast trajectory contracts, trend shape from the current baseline year through 2100, packaged WorldClim observed-baseline decoding, and an external NASA POWER observed-climatology comparison. They do not compare past forecast projections against station observations, ERA5, NOAA, or another time-varying historical target.",
  "",
  "Until a time-varying projection-vs-observation hindcast matrix exists, Phase 5 validation remains partial. The app can show this report as build evidence, but it must not claim historical forecast skill from it.",
  "",
  "## Trend Review Summary",
  "",
  "Trend review flags are unresolved scientific-review evidence. They are intentionally visible and are not automatically hidden by green CI.",
  "",
  "| Scenario | Meaning | Review items |",
  "| --- | --- | ---: |",
  ...rowsByScenario,
  "",
  "| Flag type | Count |",
  "| --- | ---: |",
  ...flagRows,
  "",
  "Interpretation notes:",
  "",
  "- `anomalyDown` and `tempDown` are not automatically wrong in a low-warming pathway, because late-century stabilization or decline can be physically plausible. They still require an explanation in the methodology and UI so users do not interpret the graph as a rendering bug.",
  "- `precipStep` identifies a year-to-year precipitation jump large enough to deserve human review before anyone smooths, suppresses, or explains it. Smoothing without a grounded method would be another form of fabricated science.",
  "",
  "## Review Items",
  "",
  "| Scenario | Place | Flags |",
  "| --- | --- | --- |",
  ...reviewRows,
  "",
  "## Reproduce",
  "",
  "```bash",
  "FUPIT_AUDIT_JSON=1 node scripts/audit-trajectories.mjs > data/trajectory-audit-summary.json",
  "npm run build:observation-validation",
  "npm run report:validation",
  "npm run smoke:validation-report",
  "npm run audit:trajectories",
  "```",
  "",
  "## Launch Implication",
  "",
  "This report is useful public evidence because it makes the current build auditable and keeps scientific review flags visible. It does not replace the launch blockers in `docs/PLAN.md`: Replit republish, production cache purge/version proof, live verification, live screenshots, and a true time-varying projection-vs-observation hindcast report.",
];

writeFileSync(outPath, `${lines.join("\n")}\n`);
console.log(`wrote ${path.relative(repoRoot, outPath)}`);
