#!/usr/bin/env node
// Copy the OG-card fonts into the server bundle output so the production server
// (dist/index.js) can read them via import.meta.dirname/assets/fonts. esbuild
// bundles only JS and does not copy these binary assets, so this runs after it.
import { cpSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(repoRoot, "server", "assets", "fonts");
const dest = path.join(repoRoot, "dist", "assets", "fonts");

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`copied OG fonts -> dist/assets/fonts`);
