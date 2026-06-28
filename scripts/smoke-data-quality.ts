import assert from "node:assert/strict";
import { loadDataQuality } from "../server/data-quality";

const report = loadDataQuality() as Record<string, any>;

assert.equal(report.version, "data-quality-v1");
assert.ok(String(report.methodVersion).startsWith("grounded-grid-i16-v2"));
assert.equal(report.sourceRegistryVersion, "source-registry-v1");
assert.ok(Array.isArray(report.artifacts) && report.artifacts.length >= 7);
assert.ok(report.artifacts.every((artifact: any) => artifact.bytes > 0 && /^[a-f0-9]{64}$/.test(artifact.sha256)));
assert.equal(report.sourceRegistry.rowCount, 8);
assert.ok(report.sourceRegistry.rows.some((row: any) => row.sourceId === "ipcc-ar6-amoc" && row.displayPolicy === "show-as-context-no-local-correction"));
assert.equal(report.rankings.catalogSize, 45);
assert.equal(report.rankings.entryCount, 816);
assert.equal(report.trajectoryAudit.cityCount, 13);
assert.equal(report.trajectoryAudit.scenarioCount, 4);
assert.equal(report.trajectoryAudit.yearCount, 76);
assert.equal(report.trajectoryAudit.resultCount, 52);
assert.ok(report.trajectoryAudit.trendReviewCount > 0);
assert.equal(report.validationReport.repoPath, "docs/VALIDATION_REPORT.md");
assert.equal(report.validationReport.historicalObservationHindcast, "pending");
assert.ok(report.validationReport.blockers.some((blocker: string) => blocker.includes("No NOAA/ERA5/WorldClim")));
assert.ok(report.validationReport.trendReviewSummary.some((item: any) => item.kind === "precipStep" && item.count >= 1));
assert.ok(report.limitations.some((limit: string) => limit.includes("Replit deployment")));
assert.ok(report.limitations.some((limit: string) => limit.includes("quantified AMOC")));

console.log("data-quality smoke passed");
