# ingest/ — offline grounding pipeline (Phase 2)

Builds the global forecast grid from real climate science, then loads it into
Postgres for the web app to serve. **Runs offline on a GPU/compute box (Spark),
never on Replit or a laptop.** The web app only reads the cache it produces.

Engine: IPCC AR6 / CMIP6 + NASA AR6 sea level. NOT cBottle (see
`../docs/architecture/SCIENTIFIC_GROUNDING.md` for why). No invented numbers —
every output value carries a source + method + uncertainty range.

## Status: contract only (not yet implemented)

Blocked on one external dependency the operator must provide:

1. **Copernicus Climate Data Store (CDS) account + API key** — free, required to
   download CMIP6 / Climate Atlas data. Sign up: https://cds.climate.copernicus.eu
   → put the key in `~/.cdsapirc` on the compute box. (HUMAN INPUT REQUIRED)
2. **Compute target** — confirm Spark (Amsterdam) as the run host. No GPU is
   strictly needed for the AR6/CMIP6 path (it's data processing, not model
   inference); a normal Linux box with disk + bandwidth suffices.

Once (1) is in place, implement the components below.

## Planned components (see ../docs/architecture/ARCHITECTURE.md)

| Script | Input → Output |
|---|---|
| `fetch_cmip6.py` | Copernicus CDS API → CMIP6 NetCDF per SSP (temp, precip, humidity) |
| `fetch_atlas.py` | IPCC-WG1/Atlas CSV → region-aggregated anomalies (validation anchors) |
| `fetch_sealevel.py` | NASA AR6 archive (Zenodo) → per-location sea-level rise per SSP |
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
