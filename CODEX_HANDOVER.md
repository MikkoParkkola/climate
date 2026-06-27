# CODEX HANDOVER — finish fupit Phase 4 (grounded serving) + deploy

**Written 2026-06-27 by Claude (running low on quota). You are codex, picking up.**
Read this top to bottom once, then execute the checklist. Everything you need is here;
deeper context is in `docs/PLAN.md` ("Phase 4 handoff") and `docs/architecture/`.

## ✅ UPDATE (Codex 2026-06-27) — code pushed, deploy/cache still not complete

Supersedes the older "not merged" and "cleanup pending" notes below where they conflict.

- `main` includes the grounded engine work through `3636727`.
- Cleanup is done: `cbottle_runner.py` and `conflict_area.txt` are deleted, `threat_model.md`
  points at `server/routes.ts`, and the root `README.md` exists.
- New cache guard added after `7dbc5ed`: `climate_model_cache` payloads are wrapped with
  `MODEL_CACHE_VERSION = "grounded-grid-i16-v1:0dc3f9d188e4d757"`. Old unversioned
  cbottle-era rows read as cache misses and are overwritten on first recompute after deploy.
- `3636727` retires the legacy `/api/projections*` and `/api/climate/multi-comparison`
  location-id projection paths with HTTP 410, so they cannot serve old fabricated rows once
  deployed.
- Startup now deletes `climate_model_cache` rows whose JSON envelope is not the current
  grounded-grid version. Manual `TRUNCATE climate_model_cache;` is still acceptable and
  cleaner during Replit deploy, but the next republished app should also self-purge
  incompatible legacy rows before serving.
- Last public checks still showed `GET /methodology` returning 404 on `fupit.com`, and
  `GET /api/projections?locationId=1&year=2050` returning HTTP 200 with old fabricated
  legacy fields. Autoscale had not been republished with the route/cache fixes yet.

## ✅ UPDATE (end of session) — data steps DONE, only deploy seam left

Since first writing this, the data pipeline FINISHED and was validated. Concretely:
- Both baselines re-fetched with the float32 fix; all 8 baseline layers correct.
- Export rebuilt (`build_export.py`, 91 arrays, self-check 0 mismatches) and **already
  copied into the repo at `data/grid.i16.gz` (35 MB) + `data/manifest.json`** (committed).
- Engine re-smoked on 5 cities — all sane, **zero nulls**. Mumbai now 1222 mm with
  wettest=July (monsoon correct); Singapore 365 tropical nights (correct, was a corrupted 0).
- Local engine + contract verified: `python3 grounded_model.py 60.17 24.94 2050` returns the
  full contract reading from repo `data/`.

**What is left = Steps 5b, 6, 7 only:**
- **5b. HTTP endpoint test** — I could NOT run it locally: the server requires
  `DATABASE_URL` (Postgres) to boot and I have no local DB. The spawn→stdout→JSON.parse
  path is UNCHANGED plumbing from the old runner (only the script name changed), and the
  engine's JSON is verified, so risk is low. On any host with `DATABASE_URL` set (Replit, or
  a local Neon/Postgres), run the curl in Step 5 and confirm the response shape.
- **6. Deploy + purge cache** (BLOCKING). **7. Cleanup.**

Steps 1–4 below are DONE; keep them for reference / if you ever re-fetch.

---


---

## TL;DR of where things stand

The fabricated `cbottle_runner.py` has been **replaced** by a grounded engine
`grounded_model.py` (real CMIP6/IPCC data, offline, numpy+gzip only). Code is committed,
build is green. **What's left is mostly data plumbing + verification + deploy.** The single
blocker is a data file (`data/grid.i16.gz`) that must be regenerated on Spark once a
currently-running fetch finishes, then copied into the repo.

**Branch:** `docs/grounded-forecast-plan` (NOT merged to main yet).
**Last commit:** `a451363` "Phase 4: grounded engine replaces cbottle_runner.py".

---

## What is DONE and committed (don't redo)

- `grounded_model.py` (repo root) — the new engine. Reads `data/grid.i16.gz` +
  `data/manifest.json` with **numpy + gzip + json only** (no xarray/netcdf at serve time).
  CLI: `python grounded_model.py <lat> <lng> <year> [scenario]` and
  `python grounded_model.py --rankings <year> [scenario]`. Default scenario `ssp245`.
  Emits the **exact JSON contract** the React client already reads.
- `server/routes.ts` — all 3 Python spawn sites now call `grounded_model.py` instead of
  `cbottle_runner.py` (helper `runClimateModel` ~L68, `/api/climate-projection` ~L504,
  `/api/climate/global-rankings` ~L647). All `if (!apiKey) 503` gates removed (engine is
  offline; no NVIDIA key needed). The `climate_model_cache` is untouched and still works.
- `client/src/pages/methodology.tsx` + route in `client/src/App.tsx` — public
  `/methodology` page (honesty requirement: documents sources + exact risk bands).
- `data/ranking_cities.json` — 45 major cities the `--rankings` endpoint scores.
- `ingest/baseline_monthly.py`, `ingest/baseline_extremes.py` — produce the absolute
  baselines the engine adds deltas to. `ingest/build_export.py` — extended to pack
  `baseline-*.nc` layers into the grid.
- `docs/architecture/RESOLUTION_AND_CBOTTLE.md` — the cBottle verdict (see below).
- `codebase-map.md`, gitnexus index (3,635 nodes), `pyproject.toml` already has `numpy`.

## What is NOT done (your job)

1. **Wait for `baseline_extremes.py` on Spark to finish** (I launched it — see "Live state").
2. **Rebuild the grid export** on Spark (`build_export.py`).
3. **Copy `grid.i16.gz` + `manifest.json` into repo `data/`** and commit.
4. **Smoke-test `grounded_model.py`** with real data; fix any contract gaps.
5. **Local endpoint verify** (build + curl, NOT full e2e — model timeout trap).
6. **Deploy** (Replit) and **purge the stale cache** (BLOCKING — old rows are fabricated).
7. **Cleanup**: delete `cbottle_runner.py`, fix `threat_model.md`, remove `conflict_area.txt`.

---

## Live state on Spark (as of handover, 2026-06-27 ~01:45)

- Host: `ssh spark`, working dir `~/climate-ingest`, venv `.venv/bin/python` (Python 3.13).
- **`baseline_monthly.py`: DONE** (re-run with the float32 fix below; verified correct).
- **`baseline_extremes.py`: RUNNING** (re-run with the float32 fix; CDS cached the identical
  requests server-side so it's much faster the 2nd time — likely <30 min, not hours). Real
  PID check: `ssh spark "pgrep -af 'python baseline_extremes' | grep -v ssh"`. Writes 5
  `out/baseline-extreme-<idx>.nc`.
- Already validated: the smoke test below passed for Helsinki/Singapore/Cairo/Reykjavik;
  Mumbai exposed and confirmed the float32 bug fix.

## 🔴 CRITICAL BUG found + fixed this session (read before rebuilding the export)

`baseline_monthly.py` and `baseline_extremes.py` originally saved their `.nc` files as
**int16 with `scale_factor=0.01`**, which caps the representable range at ±327. Absolute
values above that — monsoon precip (>327 mm/month), dry-spell days CDD/TR (up to 365),
Rx5day (>327 mm) — **overflowed int16 and wrapped to NEGATIVE** (Mumbai July precip read
−267 mm). Helsinki/Cairo looked fine only because their values stay under 327.

**Fix (committed):** both `save()` now write **float32** (lossless, no overflow);
`build_export.py` re-quantizes with an adaptive per-array scale for the compact blob, so the
export stays ~37 MB. The old corrupted `.nc` files were deleted and **both baselines are
being re-fetched** (raw downloads were juicer-deleted, so re-derivation needs the CDS round
trip — already relaunched). Verified post-fix: Mumbai July precip = +362 mm, global precip
min 0.016 (no negatives), max 907 mm/month.

**Consequence for you:** the `data/grid.i16.gz` I built mid-session used the CORRUPTED int16
baselines and is stale. **You MUST rebuild the export (Step 2) from the float32 baselines**
once `baseline_extremes.py` finishes, then re-smoke.

### ⚠️ GOTCHA that cost me time (do not repeat)
`pgrep -f baseline_extremes.py` **matches your own ssh command** containing that string →
false "RUNNING". To check the real process, grep for the python invocation and exclude ssh:
```bash
ssh spark "pgrep -af 'python baseline_extremes' | grep -v ssh"
```
Also: `baseline_extremes.py` had to be **scp'd to Spark** — it was authored locally but the
copy step was missed, so it silently never ran. If you edit any `ingest/*.py`, re-copy it:
`scp ingest/<file>.py spark:~/climate-ingest/`.

---

## EXACT checklist to finish (run in order)

### Step 1 — confirm extremes baseline is done (poll, don't babysit)
```bash
ssh spark "cd ~/climate-ingest && (pgrep -af 'python baseline_extremes' | grep -v ssh >/dev/null && echo RUNNING || echo DONE) && ls out/baseline-extreme-*.nc 2>/dev/null | wc -l"
```
Want: `DONE` and `5`. If RUNNING, wait and re-poll. If it died (DONE but <5 files), check
`ssh spark "tail -40 ~/climate-ingest/base_extremes.log"` and relaunch:
```bash
ssh spark "cd ~/climate-ingest && setsid nohup .venv/bin/python baseline_extremes.py > base_extremes.log 2>&1 < /dev/null &"
```
(A few CMIP6 models skip with `RoocsValueError` — that's a CDS server-side issue, handled;
the ensemble just drops them. Only worry if a whole index ends up empty.)

### Step 2 — rebuild the compact grid export on Spark
```bash
ssh spark "cd ~/climate-ingest && .venv/bin/python build_export.py"
```
Must end with `self-check: NNNN cells, 0 mismatches (OK)`. If it says FAIL, STOP — the
encode/decode drifted; do not ship. Output: `export/grid.i16.gz` (~34MB) + `export/manifest.json`.

### Step 3 — copy export into the repo and commit
```bash
cd ~/github/climate
scp spark:~/climate-ingest/export/grid.i16.gz   data/grid.i16.gz
scp spark:~/climate-ingest/export/manifest.json data/manifest.json
git add data/grid.i16.gz data/manifest.json && git commit -m "data: grounded grid export (CMIP6/IPCC) for serving"
```
Note: `data/grid.i16.gz` is ~34MB and intentionally committed (Replit deploys the repo;
the runtime engine reads it from `data/`). `ingest/export/grid.i16.gz` is gitignored — the
repo `data/` copy is the one that ships.

### Step 4 — smoke the engine with REAL data
`grounded_model.py` reads `data/` relative to its own location (repo root), so after Step 3
the repo is self-contained. Run locally if you have numpy; otherwise run on Spark.

Local (Mac):
```bash
cd ~/github/climate && python3 grounded_model.py 60.17 24.94 2050 | python3 -m json.tool | head -40
```
On Spark (if no local numpy) — copy the engine + data next to each other first:
```bash
ssh spark "mkdir -p ~/gm-smoke/data && cd ~/gm-smoke && cp ~/climate-ingest/export/grid.i16.gz ~/climate-ingest/export/manifest.json data/"
scp grounded_model.py data/ranking_cities.json spark:~/gm-smoke/   # ranking_cities.json into ~/gm-smoke/data/ actually:
ssh spark "cp ~/gm-smoke/ranking_cities.json ~/gm-smoke/data/ 2>/dev/null; cd ~/gm-smoke && ~/climate-ingest/.venv/bin/python grounded_model.py 60.17 24.94 2050 | python3 -m json.tool | head -40"
```
**Sanity expectations** (ssp245, 2050):
- Helsinki (60.17, 24.94): `temperature.annual_mean` ~6–9 °C, `monthly` shows a seasonal
  cycle (cold Jan, warm Jul), `habitability.score` non-null, `extremes.*` non-null.
- Singapore (1.35, 103.82): annual_mean ~28–29 °C, near-flat monthly, high humidity.
- Cairo (30.04, 31.24): hot, dry, high `drought_risk`.
If any field is `null` that shouldn't be, it's a layer-name/axis mismatch between
`grounded_model.py`'s `sample(...)` keys and `manifest.json`'s `layers[].{layer,scenario,var}`.
Cross-check the manifest layer keys against the `sample("...","...","...")` calls in
`grounded_model.py::project()`.

### Step 5 — local endpoint verify (layered, NOT e2e — the model-timeout trap)
```bash
cd ~/github/climate && npm run build   # must succeed (it does today)
NODE_ENV=production node dist/index.js &   # or `npm run start`
sleep 3
curl -s -XPOST localhost:5000/api/climate-trajectory \
  -H 'content-type: application/json' \
  -d '{"coordinates":{"lat":60.17,"lng":24.94},"years":[2050]}' | python3 -m json.tool | head -60
```
Assert the response has `data.points[0].habitability.score`, `.temperature.monthly`
(length 12), `.precipitation.annual_total`, `.extremes.drought_risk`. Then load
`http://localhost:5000/methodology` in a browser (or screenshot) to confirm the page renders.
**Do NOT run a full Playwright e2e of the model** — see `.agents/memory/e2e-real-model-timeout.md`.

### Step 6 — deploy + purge stale cache (BLOCKING)
The `climate_model_cache` table holds projections from the OLD fabricated runner. They MUST
be purged or the app serves the old lies for already-cached locations:
```sql
TRUNCATE climate_model_cache;
```
Run that against the prod Postgres (Replit DB) as part of deploy. The code now has a
JSON payload cache-version guard, so old unversioned rows will not be served after deploy,
but truncation is still required to remove fabricated artifacts from prod storage.
Then merge `docs/grounded-forecast-plan` → `main` and deploy via Replit autoscale
(`npm run build` then `npm run start`, per `.replit`).

### Step 7 — cleanup (after Step 5 proves the swap works)
Historical checklist: this cleanup is now done on `main`.
- `git rm cbottle_runner.py` (the fabricated engine — gone once grounded is proven).
- Fix `threat_model.md`: it references `server/routes-simple.ts` which doesn't exist; the
  live file is `server/routes.ts`.
- `git rm conflict_area.txt` (leftover merge artifact).
- Update `docs/PLAN.md` Phase 4/6 checkboxes to `[x]`.

---

## The JSON contract grounded_model.py must satisfy (verify if you touch the engine)

The React client reads these (mapped from `client/src/`):
- `temperature`: `annual_mean`, `monthly[12]`, `monthly_labels`, `anomaly`, `min`, `max`, `seasonal_amplitude`
- `precipitation`: `annual_total`, `monthly[12]`, `anomaly_percent`, `wettest_month`, `driest_month`, `wettest_month_name`, `driest_month_name`
- `extremes`: `heat_stress_days` (int), `drought_risk` (0–100), `flood_risk` (0–100), `sea_level_rise_cm`
- `habitability`: `score`, `category` (Excellent/Good/Fair/Poor/Severe), `breakdown{temperature_comfort, precipitation_adequacy, infrastructure_adaptation, heat_stress_penalty, drought_penalty, flood_penalty, base_score, final_score}`
- `location{latitude, longitude, name, climate_zone}`, `year`, `metadata`
Missing/null values are **honest** (engine returns null where the grid has a gap) — that's
correct behavior, not a bug, per the cardinal rule. Only investigate null if a populated
region returns null.

## Risk thresholds (already documented on /methodology + in grounded_model.py constants)
- Heat: tropical nights (Tmin>20°C, ETCCDI TR) shown as raw count.
- Drought: CDD (consecutive dry days), 0d→0, 180d→100 linear.
- Flood: Rx5day (max 5-day rain mm), 0→0, 300mm→100 linear.
These bands are choices, but transparent + cited; the raw value is always shown alongside.

---

## The cBottle question (operator asked; answered, decided)
**cBottle is NOT the fix for poor local accuracy.** The gap is baseline RESOLUTION (1° cells
average over terrain). The right fix is a high-res OBSERVED baseline (WorldClim/CHELSA ~1km)
+ optionally NASA NEX-GDDP-CMIP6 (25km, bias-corrected, all SSPs). cBottle has no scenario
conditioning, underestimates the historical trend 2×, and is eval/R&D-license-blocked.
Shelved; only future role is an optional present-climate visual texture layer. Full reasoning
+ comparison table: `docs/architecture/RESOLUTION_AND_CBOTTLE.md`. This is the **v1.1 roadmap**.

---

## Pre-existing issues you'll see (NOT caused by this work, don't chase)
- `npm run check` (tsc) reports ~25 errors in `api-key-manager.tsx`,
  `multi-location-comparison.tsx`, `sea-level-map.tsx`, `climate-dashboard.tsx` (missing
  `habitability-ranking` module), `vite.ts`, `routes.ts:266` (Date type). These predate this
  work; the app ships via vite+esbuild (which don't typecheck-block) and **builds green**.
  Fixing them is separate hygiene, not a Phase 4 blocker.
