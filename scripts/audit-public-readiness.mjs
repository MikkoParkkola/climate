#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function trackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot })
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort();
}

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function exists(relativePath) {
  return existsSync(path.join(repoRoot, relativePath));
}

const failures = [];
const warnings = [];
const tracked = trackedFiles();

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const requiredFiles = [
  "README.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "AGENTS.md",
  "docs/PLAN.md",
  "docs/PRODUCT_REQUIREMENTS.md",
  "docs/VALIDATION_REPORT.md",
  "docs/architecture/ARCHITECTURE.md",
  "docs/architecture/SCIENTIFIC_GROUNDING.md",
  "docs/architecture/TECHNICAL_DESIGN.md",
];

for (const file of requiredFiles) {
  assert(exists(file), `required public-readiness file missing: ${file}`);
}

const hookBlockedFiles = [
  "SECURITY.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/bug_report.md",
  ".github/ISSUE_TEMPLATE/science_or_data_question.md",
  ".github/ISSUE_TEMPLATE/feature_request.md",
];

for (const file of hookBlockedFiles) {
  if (!exists(file)) warnings.push(`hook-blocked public-readiness file still missing: ${file}`);
}

const forbiddenTrackedPaths = [
  "cbottle_runner.py",
  "conflict_area.txt",
  "attached_assets",
  "artifacts",
  "server/routes-simple.ts",
];

for (const forbidden of forbiddenTrackedPaths) {
  assert(
    !tracked.some((file) => file === forbidden || file.startsWith(`${forbidden}/`)),
    `forbidden tracked artifact/path present: ${forbidden}`,
  );
}

const packageJson = JSON.parse(read("package.json"));
const requiredScripts = [
  "check",
  "build",
  "validate:artifacts",
  "audit:public",
  "smoke:model",
  "smoke:data-quality",
  "audit:trajectories",
  "verify:live",
  "ci",
];

for (const script of requiredScripts) {
  assert(packageJson.scripts?.[script], `package.json missing required script: ${script}`);
}

assert(
  packageJson.scripts?.ci?.includes("npm run audit:public"),
  "npm run ci must include npm run audit:public",
);

const publicDocs = [
  "README.md",
  "CONTRIBUTING.md",
  "docs/PLAN.md",
  "docs/PRODUCT_REQUIREMENTS.md",
  "docs/architecture/SCIENTIFIC_GROUNDING.md",
  "docs/architecture/TECHNICAL_DESIGN.md",
];

const privateStrategyPattern = /traffic source|business opportunit|recruiter|showcase funnel|visibility strategy|private strategy/i;
for (const file of publicDocs) {
  assert(!privateStrategyPattern.test(read(file)), `private visibility strategy language found in ${file}`);
}

const staleReferencePattern = /server\/routes-simple\.ts|routes-simple\.ts/;
for (const file of tracked) {
  if (!/\.(md|ts|tsx|js|mjs|json|yml|yaml|py|html|css)$/.test(file)) continue;
  if (["scripts/audit-public-readiness.mjs"].includes(file)) continue;
  const absolute = path.join(repoRoot, file);
  if (!existsSync(absolute) || statSync(absolute).size > 1_000_000) continue;
  assert(!staleReferencePattern.test(readFileSync(absolute, "utf8")), `stale routes-simple reference found in ${file}`);
}

const readme = read("README.md");
assert(readme.includes("npm run audit:public"), "README must document npm run audit:public");

const contributing = read("CONTRIBUTING.md");
assert(contributing.includes("npm run audit:public"), "CONTRIBUTING must include npm run audit:public in validation guidance");

if (failures.length) {
  console.error("public-readiness audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  if (warnings.length) {
    console.error("warnings:");
    for (const warning of warnings) console.error(`- ${warning}`);
  }
  process.exit(1);
}

if (warnings.length) {
  console.log(`public-readiness audit passed with warnings: ${requiredFiles.length} required public files checked; ${tracked.length} tracked files scanned`);
  console.warn("public-readiness warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
} else {
  console.log(`public-readiness audit passed: ${requiredFiles.length} required public files checked; ${tracked.length} tracked files scanned`);
}
