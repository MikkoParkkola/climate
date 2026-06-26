# ingest/ — offline grounding pipeline (Phase 2)

Builds the global forecast grid from real climate science, then loads it into
Postgres for the web app to serve. **Runs offline on a GPU/compute box (Spark),
never on Replit or a laptop.** The web app only reads the cache it produces.

Engine: IPCC AR6 / CMIP6 + NASA AR6 sea level. NOT cBottle (see
`../docs/architecture/SCIENTIFIC_GROUNDING.md` for why). No invented numbers —
every output value carries a source + method + uncertainty range.

## Status: core pipeline implemented + validated (2026-06-26)

`fetch_reduce.py` works end-to-end on Spark. Environment + credentials are set up
(CDS token in `~/.cdsapirc`, venv at `~/climate-ingest/.venv` with cdsapi/xarray/
netCDF4/scipy; dataset licences accepted). Smoke test (2 models, SSP2-4.5, 2050)
produced a 95 KB global grid with scientifically-correct patterns: +1.56 °C global
mean (AR6 band), Arctic amplification (+3.15 °C Svalbard), land–sea contrast.

Remaining: run the full batch (all variables × 5 scenarios × 8 decades × 10 models),
add risk indices, and the Postgres loader. Sea level (NASA/IPCC AR6) is **done +
validated** (`fetch_sealevel.py`): regional relative sea level with land motion,
median + likely range, scientifically correct fingerprints (Baltic uplift low,
subsiding Pacific/US-East coasts high).

## Method: delta / change-factor (no cBottle in v1)

Engine = IPCC AR6 / CMIP6 ensemble (10 models). We store only the modeled CHANGE vs
the 1995–2014 baseline; the app adds it to real observed local climate at query time
(see `../docs/architecture/ARCHITECTURE.md`). cBottle is a deferred, license-gated,
unvalidated future enhancement for per-location high-res sharpening — not in v1.

## Model ensemble (10, operator decision)

`access_cm2, cesm2, cmcc_esm2, cnrm_cm6_1, ec_earth3, gfdl_esm4, miroc6, mri_esm2_0,
noresm2_lm, ukesm1_0_ll`. Per-(model,scenario,variable) gaps are skipped and logged
(SSP1-1.9 has sparser coverage) — no silent caps.

## Disk efficiency (hard constraint)

Juicer model: download one slice → reduce to a change field → DELETE raw → next.
Store deltas only (not raw, not full time series), decade anchors, int16-quantized +
zlib. Whole-planet product ≈ 20–40 MB. See ARCHITECTURE.md "Storage & disk efficiency".

## Compute profile (full batch)

I/O-bound on the CDS queue, **not** CPU/GPU/RAM-bound. No GPU (pure numpy/xarray/
scipy). Peak RAM ~1–2 GB per slice, released immediately. Disk transient (raw deleted
after each reduce). The only "a lot" is wall-clock: ~1,230 CDS requests, each queued
1–3 min server-side. CDS retrievals run in a thread pool — tune with
`CDS_CONCURRENCY` (default 6). The historical baseline is fetched once per
(model, variable) and reused across all 5 scenarios.


## Planned components (see ../docs/architecture/ARCHITECTURE.md)

| Script | Input → Output |
|---|---|
| `fetch_cmip6.py` | Copernicus CDS API → CMIP6 NetCDF per SSP (temp, precip, humidity) |
| `fetch_atlas.py` | IPCC-WG1/Atlas CSV → region-aggregated anomalies (validation anchors) |
| `calibrate.py` | temperature grids + AR6 SPM.1 anchors → `out/calibration.json` (per-scenario/decade scaling k = assessed/raw for the model-consensus-vs-IPCC display). **Built + validated 2026-06-26.** Temperature only. |
| `fetch_sealevel.py` | IPCC AR6 regional sea level (Zenodo 5914710, FACTS, total RSL incl. land motion) → `out/sealevel__<scenario>.nc` (median + 17th/83rd percentile, regridded to 1°, inland cells masked). **Built + validated 2026-06-26.** |
| `baseline.py` | NOAA climatology → present-day anchor (reuse existing logic) |
| `build_grid.py` | regrid → global lat/lng grid × {2030..2100 by decade} × 5 SSPs; derive risk indices via documented formulas; attach provenance + uncertainty range |
| `load_cache.py` | upsert → Postgres cache table (schema extension below) |

## Scenarios (all five — operator decision)

`ssp119`, `ssp126`, `ssp245`, `ssp370`, `ssp585`.

## Schema extension required (shared/schema.ts)

Before `load_cache.py`, extend the cache table with: `scenario` (not null),
`value_low` / `value_high` per metric (uncertainty range), `source` (provenance
string), `method_version` (for cache invalidation). Extend the unique index to
include `scenario`.

## Validation gate (Phase 5, before serving)

- Global mean of the grid under each SSP at 2100 must match AR6 Table SPM.1
  within its very-likely range.
- Present-day hindcast must match NOAA/ERA5 observations; publish error stats.
- Verify in layers (endpoint JSON asserts + build + screenshot), never one giant
  e2e — see `../.agents/memory/e2e-real-model-timeout.md`.
