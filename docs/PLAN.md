# PLAN — from fabricated to grounded

**Goal:** serve accurate, scientifically-grounded climate forecasts for any location on Earth out to **2100**, precomputed and cached, traceable to real sources: **IPCC AR6 / CMIP6** scenario data, **NASA AR6** sea-level projections, and authoritative public datasets. (cBottle: shelved — see below.)

**North-star test:** every number a user sees can be traced to a source and method. No invented coefficients. (Rams #6 — Honest.)

> Architecture/how-to: `docs/architecture/ARCHITECTURE.md`. Data sources + methodology: `docs/architecture/SCIENTIFIC_GROUNDING.md`. Baseline truth: `docs/CURRENT_STATE.md`.

## Strategy in one breath (updated after research 2026-06-26)

Research verdict: **cBottle cannot be the forecast engine.** It is a present-climate sampler with no CO₂/scenario conditioning, capped to 1970–2022, underestimates even the historical trend 2×, and ships under an eval/R&D-only weights license. The 2100 signal comes from **IPCC AR6 / CMIP6 scenario data** (free, machine-readable, per-location, per-SSP, with uncertainty ranges) plus **NASA AR6 sea-level projections**. Build the global grid **offline** (CMIP6 regridding + AR6 anchors + sea level), write it to the **cache**, and serve from cache only — no model in the request path. cBottle is shelved as an optional future high-res texture layer (license-gated, off the critical path). See `architecture/SCIENTIFIC_GROUNDING.md` + `architecture/ARCHITECTURE.md`.

## Phases

### Phase 0 — Stop the lie (immediate, small)
- The app currently serves fabricated numbers. Either (a) add a prominent "preview / non-scientific estimate" label to all projections, or (b) gate the model behind a flag until Phase 3 data exists. Operator decision.
- **DoD:** no user sees a fabricated number presented as authoritative.

### Phase 1 — Lock the scientific grounding spec
- Finalize `SCIENTIFIC_GROUNDING.md`: exact datasets, versions, URLs, licenses, and the method for each served variable.
- Pick which **IPCC SSP scenarios** to support (recommend SSP1-2.6 / SSP2-4.5 / SSP5-8.5 — low/mid/high). Operator decision.
- **DoD:** every served field maps to a named source + method, peer-reviewed or authoritative.

### Phase 2 — Build the offline ingestion pipeline (CMIP6 + AR6 + sea level)
- Create `ingest/` (offline, runs on Spark/cloud, never Replit/Mac): fetch CMIP6 via Copernicus CDS API, AR6 anchors, NASA sea-level archive, NOAA baseline. See `ARCHITECTURE.md` for component layout.
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
- Delete heuristic `cbottle_runner.py` once replaced. Fix `threat_model.md` (`routes-simple.ts` → `routes.ts`). Remove `conflict_area.txt`. Add root README.
- **DoD:** no dead fabrication code; docs match reality.

## Decisions (resolved 2026-06-26)
1. **Scenarios** — support **all five**: SSP1-1.9, SSP1-2.6, SSP2-4.5, SSP3-7.0, SSP5-8.5. ✅
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
- [x] Phase 2 — ingest pipeline COMPLETE. `fetch_reduce.py` (CMIP6 temp/precip/humidity deltas), `fetch_sealevel.py` (AR6 sea level), `fetch_extremes.py` (5 ETCCDI risk indices), `baseline_monthly.py` (1995–2014 monthly climatology), `baseline_extremes.py` (absolute ETCCDI baselines). Calibration layer (`calibration.json`, IPCC hot-model k). Validated on Spark. ~42 grids in `ingest/out/`.
- [x] Phase 3 — global grid (Option C, NOT Postgres). Operator chose to serve a compact binary export instead of loading 7.8M rows into Postgres. `build_export.py` packs all grids → `ingest/export/grid.i16.gz` (~34MB) + `manifest.json` (int16 + byte-shuffle + gzip; numpy-only decode). Self-check: 16600 cells re-decoded vs source NetCDF, 0 mismatches.
- [~] Phase 4 — serving layer refactor. **Engine swapped:** `grounded_model.py` replaces `cbottle_runner.py` at all 3 spawn sites in `server/routes.ts`; API-key gates removed (engine is offline). Reads `data/grid.i16.gz` with numpy+gzip only — no xarray/netcdf at serve time, no NVIDIA API. Build green. **Remaining:** copy final export to `data/` after baseline-extremes finish; live endpoint smoke; scenario selector + uncertainty UI (deferred to v1.1); purge stale `climate_model_cache` on deploy (BLOCKING — old rows are fabricated cbottle output).
- [x] Phase 5 (partial) — `/methodology` public page shipped (`client/src/pages/methodology.tsx`, route in `App.tsx`), documents full grounding stack + exact risk threshold bands. **Remaining:** hindcast validation report; `llms.txt` refresh.
- [ ] Phase 6 — cleanup. Delete `cbottle_runner.py` AFTER live smoke proves the swap; fix `threat_model.md` (`routes-simple.ts`→`routes.ts`); remove `conflict_area.txt`.

## Phase 4 handoff (2026-06-27) — pick up here

**Branch:** `docs/grounded-forecast-plan`. **Done this session:** grounded engine written + wired, methodology page, ranking-cities list, prod-dep verified (numpy in `pyproject.toml`), gitnexus re-indexed (3,635 nodes).

**Blocking before deploy, in order:**
1. Wait for `baseline_extremes.py` on Spark (`~/climate-ingest`, CDS-queue-bound; 5 ETCCDI absolute baselines). Check: `ssh spark 'cd ~/climate-ingest && ls out/baseline-extreme-*.nc | wc -l'` (want 5).
2. Re-run `python ingest/build_export.py` on Spark → fresh `export/grid.i16.gz` + `manifest.json` (now with baseline + baseline-extreme layers). Self-check must print `0 mismatches`.
3. Copy `export/grid.i16.gz` + `export/manifest.json` → repo `data/` (alongside `data/ranking_cities.json`).
4. Smoke `grounded_model.py` on Spark: `python grounded_model.py 60.17 24.94 2050` (Helsinki) → expect annual_mean ~6–9°C, seasonal monthly cycle, non-null habitability. Repeat Singapore (1.35 103.82), Cairo (30.04 31.24). Fix any contract gaps.
5. Local: `npm run build`, start, then `curl -s -XPOST localhost:5000/api/climate-trajectory -d '{"coordinates":{"lat":60.17,"lng":24.94},"years":[2050]}' -H 'content-type: application/json'` → assert JSON has `data.points[0].habitability.score`, `.temperature.monthly` (12), `.extremes.drought_risk`.
6. Deploy (Replit autoscale) + **purge `climate_model_cache`** (stale fabricated rows) — `TRUNCATE climate_model_cache;` or add a model-version column to the cache key.

**Known risks:** (a) contract drift — `grounded_model.py` output must match what the React client reads (`habitability.breakdown` keys, `monthly[12]`); mapped from client but first wire-up may surface one mismatch. (b) a few CMIP6 models skip with server-side `RoocsValueError` (handled — ensemble drops them).
