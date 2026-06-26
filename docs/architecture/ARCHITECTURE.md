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
  │   ├─ baseline.py         NOAA climatology (present-day anchor)   │
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

- **Spatial:** start coarse (e.g. 1°×1° ≈ 64,800 land+ocean cells; or land-only to cut ~70%). Interpolate between cells at query time.
- **Temporal:** decade anchors 2030, 2040, …, 2100 (7 steps). Linear-interpolate intermediate years (reuse the legacy interpolation logic — it was the one sound part).
- **Scenarios:** 3 (low/mid/high) → multiply grid by 3.
- Total cache rows ≈ cells × 7 decades × 3 scenarios. At 1° land-only ≈ ~19k × 21 ≈ ~400k rows — trivial for Postgres.

## Schema changes (`shared/schema.ts`)

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

## cBottle (deferred, optional)

If ever revisited as a high-res spatial-texture/sampling layer: self-hosted GPU only, driven by scenario-derived SST, clearly labeled as enhancement, and **only after** the weights license is cleared for production. Not on the critical path. Tracked, not scheduled.

## Validation (Phase 5)

- **Hindcast:** generate present-day (2020s) values from the pipeline, compare to NOAA/ERA5 observations; publish error stats.
- **Anchor check:** global-mean of the grid under each SSP at 2100 must match AR6 Table SPM.1 within range.
- Layered verification per `.agents/memory/e2e-real-model-timeout.md` — endpoint JSON asserts + build + screenshot, not one giant e2e.
