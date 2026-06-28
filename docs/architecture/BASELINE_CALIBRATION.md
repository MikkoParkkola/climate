# Baseline calibration — present-day anchoring

Status: **2026-06** — hindcast harness landed; grid re-anchor designed, not yet built (needs gridded ERA5 download).

## The problem

The engine produces a present-day / 2025 value as **WorldClim 1970–2000 observed normal + CMIP6 warming delta**, where the CMIP6 delta is referenced to **1995–2014** (IPCC AR6 present-day baseline). The observed baseline period (1970–2000, center ≈1985) does **not** match the delta reference period (1995–2014, center ≈2005), so the anchor is ~35 years stale and the result carries a period-mismatch error.

There is no step that bias-corrects the result to recent observed climate. The existing NASA POWER check only compares two *historical* (1981–2000) climatologies — explicitly "not a future projection hindcast."

## Measured present-day error (hindcast)

`npm run audit:hindcast` (scripts/hindcast_validation.py) compares model 2025 annual-mean temperature against independent Open-Meteo ERA5 observations (2015–2024) at 18 cities. Writes `data/hindcast-validation.openmeteo.json`.

Latest run: **bias +0.34 °C, MAE 0.61 °C, RMSE 0.70 °C**; residuals −0.76 (Cairo) to +1.18 (Mumbai). Pattern: northern/temperate cities lean cold (period-anchor + CMIP6 ensemble-mean under-warming recent decades); tropical/urban lean warm (largely ERA5 ~25 km coarseness vs WorldClim's resolved city point, i.e. an observation-product gap, not a model fault).

## The defensible fix (designed)

Delta-change downscaling done correctly. Four invariants: (1) observed baseline period == GCM delta reference period; (2) anomaly-only from models (never absolutes); (3) high-res observed pattern preserved; (4) forced signal, not a single weather year. The engine satisfies 2–4; only #1 is broken.

**Decision: re-anchor the observed baseline to the 1991–2020 WMO standard normal.**
- 1991–2020 is the current official 30-year "normal" and the most recent *standard* normal (a 5-year window would be weather, not climate).
- Its center (~2005.5) sits only ~0.1 °C from the existing CMIP6 1995–2014 reference (verified: Helsinki +0.15, London +0.07, Cairo +0.09), so period-consistency holds **without re-deriving the CMIP6 deltas from raw source**. This collapses the ~0.4 °C stale-anchor error to ~0.1 °C.
- A more-recent window (e.g. 2005–2024) would sit ~0.5 °C off the GCM reference and would require reprocessing raw CMIP6 — a premium option, deferred.

**Build method (preserves WorldClim's 1 km detail):**
```
Normal_1991-2020(1km) = WorldClim_1970-2000(1km) + [ ERA5(1991-2020) − ERA5(1970-2000) ]
```
Both ERA5 terms are the same reanalysis product, so the coarse-grid representativeness error cancels in the difference, leaving the real observed warming signal grafted onto WorldClim's high-res pattern. Grounded; no fabrication.

**Optional (only if the hindcast shows systematic residuals after re-anchoring):** trend-preserving quantile delta mapping against the observed overlap. Do not apply a bias correction that distorts the projected trend.

## What's pending (not yet built)

The re-anchor needs a **gridded** ERA5 1970–2000 and 1991–2020 monthly normal (Copernicus CDS / ERA5-Land) to build the delta field — a data download, not an in-session task (the free point API cannot serve a global grid). Once fetched:
1. Build the 1991–2020 observed-baseline grid artifact (new worldclim10m-equivalent, or a delta layer).
2. Repoint both engines' observed baseline; bump model + cache versions; re-verify Python↔Node parity.
3. Rebuild ranking artifacts; re-run `audit:hindcast` and confirm the bias shrinks; publish the residuals on /methodology.
