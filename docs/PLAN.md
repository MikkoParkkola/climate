# PLAN — from fabricated to grounded

**Goal:** serve accurate, scientifically-grounded climate forecasts for any location on Earth out to **2100**, precomputed and cached, traceable to real sources: **IPCC AR6 / CMIP6** scenario data, **NASA AR6** sea-level projections, and authoritative public datasets. (cBottle: shelved — see below.)

**North-star test:** every number a user sees can be traced to a source and method. No invented coefficients. (Rams #6 — Honest.)

> Product requirements: `docs/PRODUCT_REQUIREMENTS.md`. Replit-scale technical design: `docs/architecture/TECHNICAL_DESIGN.md`. Architecture/how-to: `docs/architecture/ARCHITECTURE.md`. Data sources + methodology: `docs/architecture/SCIENTIFIC_GROUNDING.md`. Baseline truth: `docs/CURRENT_STATE.md`.

## Strategy in one breath (updated after research 2026-06-26)

Research verdict: **cBottle cannot be the forecast engine.** It is a present-climate sampler with no CO₂/scenario conditioning, capped to 1970–2022, underestimates even the historical trend 2×, and ships under an eval/R&D-only weights license. The 2100 signal comes from **IPCC AR6 / CMIP6 scenario data** (free, machine-readable, per-location, per-SSP, with uncertainty ranges) plus **NASA AR6 sea-level projections**. Build the global grid **offline** (CMIP6 regridding + AR6 anchors + sea level), write it to the **cache**, and serve from cache only — no model in the request path. cBottle is shelved as an optional future high-res texture layer (license-gated, off the critical path). See `architecture/SCIENTIFIC_GROUNDING.md` + `architecture/ARCHITECTURE.md`.

## Phases

### Phase 0 — Stop the lie (immediate, small)
- Historical problem: the old app served fabricated numbers. The current code removes the fabricated runner and rejects retired legacy projection routes.
- **DoD:** no user sees a fabricated number presented as authoritative.

### Phase 1 — Lock the scientific grounding spec
- Finalize `SCIENTIFIC_GROUNDING.md`: exact datasets, versions, URLs, licenses, and the method for each served variable.
- Pick which **IPCC SSP scenarios** to support (recommend SSP1-2.6 / SSP2-4.5 / SSP5-8.5 — low/mid/high). Operator decision.
- **DoD:** every served field maps to a named source + method, peer-reviewed or authoritative.

### Phase 2 — Build the offline ingestion pipeline (CMIP6 + AR6 + sea level)
- Create `ingest/` (offline, runs on Spark/cloud, never Replit/Mac): fetch CMIP6 via Copernicus CDS API, AR6 anchors, NASA sea-level archive, and observed baseline climatology. See `ARCHITECTURE.md` for component layout.
- Replace `cbottle_runner.py`'s role: it is **not** the engine. The pipeline produces grounded per-location stats from scenario data, with uncertainty ranges + provenance, via documented formulas (no magic constants).
- **DoD:** pipeline produces, for a sample of locations/years/scenarios, values whose global mean matches AR6 Table SPM.1 within range, and whose present-day hindcast matches NOAA/ERA5.

### Phase 3 — Build the global cache to 2100
- Run the pipeline over a global grid × decade steps (2030…2100) × supported scenarios. Resolution = product/compute tradeoff (`ARCHITECTURE.md`).
- Store in cache (extend schema: scenario id, uncertainty bounds, provenance, method version) + sea-level layer.
- Interpolate intermediate years/locations from grid (reuse legacy interpolation).
- **DoD:** any lat/lng/year/scenario resolves from cache in <200ms with provenance attached.

### Phase 4 — Serving layer refactor
- App reads grounded cache only. Add **scenario selector** and **honest uncertainty UI** (ranges, not false precision).
- **Model consensus vs IPCC-calibrated**: show both numbers + the adjustment, default to the IPCC-calibrated value, so the "hot model" tuning is visible (operator decision 2026-06-26; method in `architecture/SCIENTIFIC_GROUNDING.md`).
- Show **provenance** on every projection. Drop the Python subprocess from the request path.
- **DoD:** UI surfaces source + scenario + uncertainty + the raw/calibrated pair; no live model dependency in the request path.

### Phase 5 — Validation & honesty
- Hindcast validation report (pipeline vs observations) + AR6 anchor check. Document known limits.
- Add `/methodology` public page; keep `client/public/llms.txt` accurate for AI crawlers.
- **DoD:** published methodology; validation numbers in repo.

### Phase 6 — Cleanup
- Delete the heuristic legacy runner once replaced. Fix stale threat-model route references. Remove merge artifacts. Add root README.
- **DoD:** no dead fabrication code; docs match reality.

## Decisions (resolved 2026-06-26)
1. **Scenarios** — full habitability forecasts support **four** scenarios: SSP1-2.6, SSP2-4.5, SSP3-7.0, SSP5-8.5. SSP1-1.9 remains documented as a scientifically relevant pathway, but it is withheld from full forecasts until a grounded heat/drought/flood source exists. ✅
2. **Phase 0 stance** — **label fabricated data as "preview / non-scientific estimate"** (app stays usable, honesty preserved). ✅
3. **Grid resolution & year cadence** — default 1° land-first, decade anchors 2030–2100 (revisit if accuracy demands finer). Open to change.
4. **cBottle** — **shelved** as forecast engine (recommended); optional future high-res texture layer only. ✅

## Status
- [x] Diagnosis (`CURRENT_STATE.md`)
- [x] Agent guide (`AGENTS.md` + `CLAUDE.md`/`LLM.md` symlinks)
- [x] `ARCHITECTURE.md`
- [x] `SCIENTIFIC_GROUNDING.md`
- [x] Operator decisions (above)
- [x] Phase 0 — preview labeling (global non-dismissible banner, `client/src/components/preview-banner.tsx`, mounted in `App.tsx`; build green)
- [x] Phase 1 — grounding spec locked (`architecture/SCIENTIFIC_GROUNDING.md`, 5 scenarios, per-variable source/method/citation map)
- [x] Phase 2 — ingest pipeline COMPLETE. `fetch_reduce.py` (CMIP6 temp/precip/humidity deltas), `fetch_sealevel.py` (AR6 sea level), `fetch_extremes.py` (5 ETCCDI risk indices), `baseline_monthly.py` (1995–2014 CMIP6 monthly fallback climatology), `build_worldclim_baseline.py` (WorldClim v2.1 observed 10 arc-minute monthly baseline), `baseline_extremes.py` (absolute ETCCDI baselines). Calibration layer (`calibration.json`, IPCC hot-model k). Validated on Spark/local smoke. ~42 grids in `ingest/out/` plus compact serving artifacts in `data/`.
- [x] Phase 3 — global grid (Option C, NOT Postgres). Operator chose to serve a compact binary export instead of loading 7.8M rows into Postgres. `build_export.py` packs all grids → `ingest/export/grid.i16.gz` (~34MB) + `manifest.json` (int16 + byte-shuffle + gzip; numpy-only decode). Self-check: 16600 cells re-decoded vs source NetCDF, 0 mismatches.
- [~] Phase 4 — serving layer refactor. **Engine swapped:** `grounded_model.py` replaces the old fabricated runner in `server/routes.ts`; API-key gates removed (engine is offline). Reads `data/grid.i16.gz` with numpy+gzip only — no xarray/netcdf at serve time, no NVIDIA API. Final grid export is in `data/`; direct engine smoke, production build, `npm run ci`, and local Postgres-backed endpoint smoke are green. `climate_model_cache` identity now includes scenario, cache version, and source-registry version, so old unversioned cbottle-era rows read as misses; server startup deletes incompatible rows. Source registry, formal `GET /api/climate-twin`, and curated-city ranking artifacts are served from static data, not request-time global Python loops. Scenario selector, projection uncertainty receipts, and bounded climate-twin catalog receipts are implemented on the main result flow; comparison mode also has an explicit scenario selector and a regression guard for the year-slider overlap bug. Node grid artifact decode/interpolation parity is covered by `npm run smoke:grid-reader`; full Node projected-response parity has an initial fixture matrix in `npm run smoke:node-model`; `/api/climate-trajectory` and climate-twin cache fills can opt into Node with `CLIMATE_GRID_ENGINE=node` while Python remains default. **Remaining:** Replit autoscale republish, production cache purge/version-guard proof, live verification, live screenshot capture, and Node-path endpoint/performance hardening (including the compatibility `/api/climate-projection` branch).
- [x] Phase 5 (partial) — `/methodology` public page shipped (`client/src/pages/methodology.tsx`, route in `App.tsx`), documents full grounding stack + exact risk threshold bands. `/rankings` now exposes bounded top-10 lists from the curated-city artifact with catalog size, source receipts, caveats, and no safe-city/global-complete claims. `/data-quality` exposes packaged artifact hashes, source-registry rows, curated-ranking coverage, trajectory-audit coverage, trend-review flags, validation-report status, and launch limitations. The main result receipt now offers copy/download raw forecast JSON with selected-year point, full trajectory, scenario, model metadata, uncertainty fields, and source trail; `npm run smoke:raw-json` guards that surface. The result page now includes a guarded "why this changed" score-component ranking, per-decade trend rates, grounded low-high uncertainty bands on temperature/precipitation/sea-level trend charts, a current-year-to-2100 living-conditions roadmap with scenario deltas when contrast is loaded, keyboard/touch-accessible source receipts, daily-life interpretation, explicit missing-domain caveats, and sea-level wording that frames AR6 values as regional context until a coastal-exposure/elevation gate exists; `npm run smoke:storyline` guards that surface. The result page now has a shareable climate story card that packages the selected-year metrics, top visible score driver, climate-twin analog, platform share API, clipboard fallback, downloadable PNG social image, grounded follow-up comparison prompts, and caveats against unregistered enrichments or safe-city claims; `npm run smoke:share-card` guards the R10 share surface. The result page also has an on-demand same-location scenario contrast for lower-warming, current-policy-adjacent, high, and stress pathways with an accessible method receipt; `npm run smoke:scenario-contrast` guards the R7 pathway framing and caveats. `docs/VALIDATION_REPORT.md` is generated by `npm run report:validation` and guarded by `npm run smoke:validation-report`; it proves the fixture trajectory contract and explicitly keeps true observation-backed hindcast validation pending. `npm run validate:artifacts` also verifies the current climate-twin analog catalog and registered source rows. `client/public/llms.txt` refreshed for grounded fupit pages. `npm run screenshots:capture` provides a Chrome-based desktop/mobile screenshot harness for the layered launch check. **Remaining:** observation-backed hindcast comparison and live screenshot evidence.
- [x] Phase 6 — cleanup. Deleted the heuristic legacy runner, fixed the stale threat-model route reference, removed the merge artifact, added root `README.md`, added public license/contribution docs, and removed tracked Replit mockup/pasted local assets from the public tree.

## Phase 4 handoff (2026-06-27) — pick up here

**Branch:** current implementation work is on `codex/fupit-implementation-plan`. **Done:** grounded engine written + wired, final grid export validated and copied to `data/`, methodology/data-quality/rankings pages added, ranking-cities list added, source registry added, cache identity versioned by scenario/cache/source, curated rankings precomputed, formal bounded `GET /api/climate-twin` added with `npm run smoke:twin`, legacy dashboard/report source files removed, legacy side-door endpoints retired to 410, prod dependency verified (`numpy` in `pyproject.toml`, `pg` direct dependency), fabricated runner deleted, stale threat-model route fixed, and local Postgres-backed endpoint smoke passed.

**Blocking before claiming public launch complete, in order:**
1. Republish Replit autoscale from the current code.
2. Against the production Replit Postgres, run `TRUNCATE climate_model_cache;` or verify startup deleted every incompatible row before public forecasts are served. The app now prevents unversioned or mismatched cache rows from returning as hits and retires the legacy projection endpoints.
3. Run `npm run verify:live`. For the first post-purge forecast proof, use `FUPIT_REQUIRE_FRESH=1` with a new land coordinate so the verifier fails if the response is read from cache.
4. Capture desktop/mobile screenshots for home, single-location, comparison, rankings, methodology, and data-quality. Use `npm run screenshots:capture -- --base https://fupit.com --include-single --out artifacts/release-screenshots` after Replit publish/cache purge. Do not run a full browser e2e over the real model; verify in layers.

**Known risks:** (a) contract drift — `grounded_model.py` output must match what the React client reads (`habitability.breakdown` keys, `monthly[12]`); mapped from client but first wire-up may surface one mismatch. (b) a few CMIP6 models skip with server-side `RoocsValueError` (handled — ensemble drops them).
