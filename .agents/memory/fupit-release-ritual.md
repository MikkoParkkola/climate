---
name: fupit release ritual
description: The recurring "pull GitHub -> publish -> post-deploy commands" flow for fupit/climate, incl. why ordering matters and the chromium requirement.
---

# fupit release ritual

The user (Mikko) runs a recurring release: **pull GitHub `origin/main` into the
Replit workspace, publish (Autoscale, fupit.com), then run 4 post-deploy
commands.**

## The 4 post-deploy commands MUST run AFTER the publish is live
1. `npm run db:purge-model-cache:dry-run`
2. `FUPIT_CONFIRM_CACHE_PURGE=TRUNCATE_CLIMATE_MODEL_CACHE npm run db:purge-model-cache`
3. `FUPIT_REQUIRE_FRESH=1 npm run verify:live`
4. `npm run screenshots:capture -- --base https://fupit.com --include-single --out artifacts/release-screenshots`

**Why after publish:** `verify:live` and `screenshots:capture` hit the live
`https://fupit.com`; and the cache purge must land *after* the new build is live,
otherwise the still-running old deploy re-caches stale results before the new one
takes over.

**Sequencing constraint:** `suggest_deploy` is terminal, and publishing is a
manual user action — so this is inherently a two-phase interaction: phase 1
(merge + verify + suggest_deploy), phase 2 (run the 4 commands once the user
confirms the deploy is live).

## Purge safety
`scripts/purge-climate-model-cache.mjs` only `TRUNCATE`s `climate_model_cache`
(recomputable cache, not user data), gated by
`FUPIT_CONFIRM_CACHE_PURGE=TRUNCATE_CLIMATE_MODEL_CACHE`. The workspace
`DATABASE_URL` is the same DB the Autoscale deployment uses, so running the purge
from the workspace affects production.

## screenshots:capture needs Chromium
`scripts/capture-screenshots.mjs` drives Chromium over CDP and only auto-detects
`/usr/bin/chromium[-browser]` (plus `CHROME_BIN`). The Replit env has no chromium
at those paths. Install via Nix (`installSystemDependencies(["chromium"])`) and
run the command with `CHROME_BIN=$(command -v chromium)` set, or it fails with
"no Chrome binary found".

## Re-verify after every pull
The geocoding + empty-input fix has historically been **local-only** and absent
from GitHub `origin/main` (main still calls `storage.searchClimateLocations` and
`Number(params.get("lat"))`). After each pull, re-verify: Prague/Kyiv resolve via
`/api/locations/search`, and a fresh load shows the search placeholder rather than
a bogus "0.0000, 0.0000". (Moot once the fix is pushed to GitHub.)
