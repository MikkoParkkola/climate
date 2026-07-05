#!/usr/bin/env node
import { execFileSync } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

const commit = git(["rev-parse", "HEAD"]);
const buildInfo = {
  app: "fupit",
  commit,
  shortCommit: commit ? commit.slice(0, 7) : null,
  branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
  builtAt: new Date().toISOString(),
};

const outDir = path.join(repoRoot, "dist");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "build-info.json"), `${JSON.stringify(buildInfo, null, 2)}\n`);
console.log(`wrote dist/build-info.json (${buildInfo.shortCommit ?? "unknown commit"})`);
