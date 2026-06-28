#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const script = fs.readFileSync("scripts/purge-climate-model-cache.mjs", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.match(script, /const CONFIRMATION = "TRUNCATE_CLIMATE_MODEL_CACHE"/, "purge script requires explicit confirmation token");
assert.match(script, /if \(!databaseUrl\)/, "purge script refuses to run without DATABASE_URL");
assert.match(script, /FUPIT_CONFIRM_CACHE_PURGE !== CONFIRMATION/, "purge script refuses destructive run without env confirmation");
assert.match(script, /TRUNCATE TABLE climate_model_cache/, "purge script truncates only climate_model_cache");
assert.doesNotMatch(script, /DROP TABLE|DELETE FROM users|DELETE FROM climate_locations/i, "purge script must not target unrelated tables");
assert.equal(pkg.scripts["db:purge-model-cache"], "node scripts/purge-climate-model-cache.mjs");
assert.equal(pkg.scripts["db:purge-model-cache:dry-run"], "node scripts/purge-climate-model-cache.mjs --dry-run");

console.log("cache purge script smoke passed");
