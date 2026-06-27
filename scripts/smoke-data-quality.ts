import assert from "node:assert/strict";
import { loadDataQuality } from "../server/data-quality";

const report = loadDataQuality() as Record<string, any>;

assert.equal(report.version, "data-quality-v1");
assert.ok(String(report.methodVersion).startsWith("grounded-grid-i16-v2"));
assert.equal(report.sourceRegistryVersion, "source-registry-v1");
assert.ok(Array.isArray(report.artifacts) && report.artifacts.length >= 7);
assert.ok(report.artifacts.every((artifact: any) => artifact.bytes > 0 && /^[a-f0-9]{64}$/.test(artifact.sha256)));
assert.equal(report.sourceRegistry.rowCount, 7);
assert.equal(report.rankings.catalogSize, 45);
assert.equal(report.rankings.entryCount, 816);
assert.equal(report.trajectoryAudit.cityCount, 13);
assert.equal(report.trajectoryAudit.scenarioCount, 4);
assert.equal(report.trajectoryAudit.yearCount, 76);
assert.equal(report.trajectoryAudit.resultCount, 52);
assert.ok(report.trajectoryAudit.trendReviewCount > 0);
assert.ok(report.limitations.some((limit: string) => limit.includes("Replit deployment")));

console.log("data-quality smoke passed");
