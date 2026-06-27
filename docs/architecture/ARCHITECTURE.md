# Architecture — grounded forecast pipeline

**One-line shape:** offline data pipeline (CMIP6 + AR6 + sea-level) → precomputed global grid cache → stateless public serve. The web app never calls a model at request time; it reads grounded, cited values from cache.

> Decided by research 2026-06-26 (see `SCIENTIFIC_GROUNDING.md`): IPCC AR6 / CMIP6 is the projection engine; cBottle is shelved (license + not-a-projection-model). This doc is the "how".

## Why this shape

- The 2100 signal is **slow to compute** (regridding multi-model CMIP6 NetCDF, per-location aggregation) but **static** once computed — perfect for precompute-and-cache. The existing `climate_model_cache` table is already built for exactly this.
- Replit autoscale serves the SPA + API cheaply but is **not** where heavy compute runs. All ingestion/regridding happens **offline on a workstation/GPU/cloud box** (per global compute-routing rule: never on Replit, never on Mac). Output is committed/loaded into Postgres.
- Statelessness in the request path = fast (<200ms), no rate-limit gymnastics, no Python subprocess in production.

## Components

```
                        OFFLINE (run on Spark/cloud, not Replit)
  ┌────────────────────────────────────────────────────────────────┐
  │  ingest/                                                         │
  │   ├─ fetch_cmip6.py      Copernicus CDS API → NetCDF (per SSP)   │
  │   ├─ fetch_sealevel.py   NASA AR6 archive (Zenodo) → per-point   │
  │   ├─ fetch_atlas.py      IPCC-WG1/Atlas CSV (region aggregates)  │
  │   ├─ build_worldclim_baseline.py  WorldClim observed baseline    │
  │   ├─ baseline_monthly.py CMIP6 historical fallback baseline      │
  │   ├─ build_grid.py       regrid → global lat/lng grid ×          │
  │   │                      {decade 2030..2100} × {SSP1-2.6,        │
  │   │                      SSP2-4.5, SSP5-8.5}; derive risk        │
  │   │                      indices via documented formulas;        │
  │   │                      attach provenance + uncertainty range   │
  │   └─ load_cache.py       upsert → climate_model_cache (+scenario)│
  └────────────────────────────────────────────────────────────────┘
                                   │  (DB write)
                                   ▼
                        ONLINE (Replit — serve only)
  ┌────────────────────────────────────────────────────────────────┐
  │  server/routes.ts                                                │
  │   GET /api/climate-projection?lat&lng&year&scenario             │
  │     → nearest grid cells → bilinear interp in space +           │
  │       linear interp across decades → attach provenance          │
  │     → returns value + range + source + scenario                 │
  │   (NO python subprocess, NO model call)                         │
  └────────────────────────────────────────────────────────────────┘
```

## Grid & cadence (tunable — accuracy vs precompute cost)

- **Model ensemble:** blend ~8–10 established CMIP6 models (operator decision 2026-06-26) → central estimate = ensemble mean; uncertainty = ensemble spread. Not one model (single opinion), not all (diminishing returns, huge download).

- **Spatial:** start coarse (e.g. 1°×1° ≈ 64,800 land+ocean cells; or land-only to cut ~70%). Interpolate between cells at query time.
- **Temporal:** decade anchors 2030, 2040, …, 2100 (7 steps). Linear-interpolate intermediate years (reuse the legacy interpolation logic — it was the one sound part).
- **Scenarios:** 3 (low/mid/high) → multiply grid by 3.
- Total cache rows ≈ cells × 7 decades × 3 scenarios. At 1° land-only ≈ ~19k × 21 ≈ ~400k rows — trivial for Postgres.

## Storage & disk efficiency (hard constraint — limited disk)

Raw CMIP6 is bulky; the derived product is tiny. The pipeline is a juicer: ingest raw,
keep only the reduced signal, discard raw immediately.

1. **Stream-and-discard:** process one `(model, scenario, variable, period)` at a time —
   download → reduce to a climatology field → **delete the raw NetCDF** before the next.
   Peak transient disk = a few GB, never accumulating. No raw archive kept.
2. **Store change-factors, not state:** persist only the *anomaly* (delta vs the
   1995–2014 baseline) per cell — not full time series, not absolute fields. Local
   absolute values are reconstructed at query time from the WorldClim observed
   baseline where available, with CMIP6 historical climatology as fallback, so
   stored maps can be coarse + small.
3. **Decade anchors + interpolation:** store 2030…2100 by decade; interpolate in-between
   years on read. ~8 time slices, not 75.
4. **Quantize:** encode as scaled int16 with per-variable scale/offset (e.g. temp ×10).
   ~2× shrink over float32, lossless to 0.1° precision.
5. **Compress:** delta fields are spatially smooth → high zstd/gzip ratios.
6. **Coarse stored grid (1–2°):** delta fields are smooth; sharpness comes from the
   query-time observed baseline, not stored resolution. Land-first option drops ~60–70%
   of cells if ocean isn't needed.

**Budget estimate (1° global, 5 scenarios, 8 decades, 6 vars, mean+lo+hi):**
~47M values → 187 MB float32 → **~20–40 MB** quantized+compressed. Fits in Postgres/Neon
trivially. (2° or land-only ⇒ single-digit MB.)


Extend `climate_model_cache` (or a new `climate_grid` table):
- `scenario text not null` (e.g. `ssp245`)
- `value_low real`, `value_high real` per metric (uncertainty range)
- `source text not null` (provenance string, e.g. `CMIP6/ScenarioMIP + AR6`)
- `method_version text` (so we can invalidate when methodology changes)
- keep the `(latKey, lngKey, year)` unique index → extend to include `scenario`.

## Request path changes (`server/routes.ts`)

- Add `scenario` param (validated by Zod against an enum) to projection/trajectory/rankings endpoints; default to mid (SSP2-4.5).
- Replace `spawn("python", ["cbottle_runner.py", ...])` with a pure cache read + interpolation. Drop the Python concurrency/rate-limit machinery from the hot path (keep only if cBottle texture layer is ever added).
- Every response carries `{ value, low, high, source, scenario, methodVersion }`.

## Frontend changes (`client/`)

- **Scenario selector** (low/mid/high) wired to query params.
- **Uncertainty UI**: show ranges (band on charts, ± on numbers) — never a bare false-precise figure.
- **Provenance line** on every projection: "cBottle/CMIP6 + IPCC AR6 SSP2-4.5; sea level from NASA AR6."
- Public `/methodology` page rendering `SCIENTIFIC_GROUNDING.md`.

## Local accuracy: the delta / change-factor method (primary)

Global models work on ~100 km cells — too blurry for a single searched point. The
scientifically standard fix is **delta downscaling**, not a generative model:

1. Take the **real observed present-day climate** for the exact point (WorldClim
   v2.1 10 arc-minute monthly climatology, 1970-2000, where land baseline exists).
2. Take the **change signal** from the CMIP6 ensemble for that region (e.g. +3.1 °C,
   +8% precip by 2100 under a scenario). Models are blurry on *absolute* values but
   reliable on the *anomaly* (the change).
3. Local future = observed present + modeled change. Carry the ensemble spread as the
   uncertainty range.

Cheap, license-free, proven, and directly addresses the "coarse cell over varied
terrain" problem. This is what we ship.

## cBottle — deferred local high-res pass (operator idea, parked)

Operator's idea (2026-06-26): when the ensemble is too coarse for a specific location
search, run a final sharpening pass with cBottle. Good instinct — kept as a **future
enhancement**, NOT in v1, gated on two conditions:
- **License cleared** for production (currently research/eval-only).
- **Validated** that conditioning cBottle on a scenario-derived sea-surface-temperature
  field actually improves a *future* local estimate (NVIDIA never tested this; cBottle
  adds present-climate-shaped texture by default).
If both clear: self-hosted GPU, per-search, clearly labeled, behind a flag. Until then
the delta method above is the accuracy mechanism. Not on the v1 critical path.

## Validation (Phase 5)

- **Hindcast:** generate present-day (2020s) values from the pipeline, compare to independent NOAA/ERA5 observations; publish error stats.
- **Anchor check:** global-mean of the grid under each SSP at 2100 must match AR6 Table SPM.1 within range.
- Layered verification per `.agents/memory/e2e-real-model-timeout.md` — endpoint JSON asserts + build + screenshot, not one giant e2e.
