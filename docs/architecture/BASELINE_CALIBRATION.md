# Baseline calibration — present-day anchoring

Status: **2026-06** — investigated with real observations and a hindcast. **Conclusion: the present-day baseline is already well-calibrated; a baseline re-anchor is contraindicated (it makes accuracy worse). Decision reversed from the earlier "re-anchor to 1991–2020" plan, on evidence.**

## How the present-day value is built

Headline present-day / 2025 value = **WorldClim 1970–2000 observed normal + CMIP6 warming delta** (delta referenced to 1995–2014, the IPCC AR6 present-day baseline). The high-res WorldClim pattern is preserved; only the coarse model *change* is added (correct delta-change downscaling).

## What we measured (the hindcast)

`npm run audit:hindcast` (scripts/hindcast_validation.py) compares model 2025 annual-mean temperature against independent Open-Meteo ERA5 observations (2015–2024) at 18 cities. Writes `data/hindcast-validation.openmeteo.json`.

**Result: mean bias +0.34 °C, MAE 0.61 °C, RMSE 0.70 °C.** For a 1°-grid downscaled product this is good: it is within the spread between observational products themselves (ERA5 vs WorldClim vs stations differ ~0.5 °C at a point) and far inside CMIP6 model spread (~1–3 °C).

The residual is **net warm**, not cold, and decomposes into two irreducible-without-risk sources:
1. **CMIP6 near-term delta runs slightly warm** vs observed recent warming in some regions.
2. **WorldClim vs ERA5 representativeness**: WorldClim resolves the actual city point (often warmer: urban/coastal/valley); ERA5's ~25 km cell averages in cooler surroundings — most of the tropical warm residual is this product difference, i.e. WorldClim is arguably the *better* observation there, not a model fault.

## Why the re-anchor was rejected (evidence)

The earlier plan was to shift the baseline from 1970–2000 to the 1991–2020 WMO normal using a GISTEMP observed-warming field (1970–2000 → 1991–2020, global +0.39 °C area-weighted; verified sane: Helsinki +0.95, Reykjavik +0.84, Singapore +0.28). When tested against the hindcast, it **degraded accuracy**:

| Configuration | bias | RMSE |
|---|---|---|
| **Current (shipped)** | **+0.34 °C** | **0.70 °C** |
| Re-anchored to 1991–2020 (GISTEMP) | +0.95 °C | 1.06 °C |
| IPCC-calibrated headline (existing track) | +0.25 °C | 0.66 °C |

The re-anchor double-counts warming: the CMIP6 delta (referenced to 1995–2014) already carries the 1995–2014→2025 warming, so the baseline was *not* net-cold. The "stale 1970–2000 anchor" and the "warm CMIP6 near-term delta" were two errors that largely **cancel** to the small +0.34 °C net. Fixing only the baseline unmasks the warm delta and doubles the bias. This is why the period-mismatch framing, while theoretically real, is not the dominant present-day error here.

The IPCC-calibrated track (which rescales over-hot CMIP6 models to AR6 assessed ranges, already computed and reported alongside the raw headline) is marginally better in aggregate (+0.25 / 0.66) but **mixed**: it helps the warm tropical cells and slightly worsens the cold northern cells. Not a clear enough win to change the headline; it remains available and disclosed.

## Decision

- **Keep the current baseline and raw headline.** Present-day accuracy is already good and a re-anchor is contraindicated by measurement.
- **Publish the hindcast** so present-day error is a disclosed number, not an assumption.
- If a future iteration wants to push present-day error lower, the defensible lever is a **trend-preserving, region-aware bias correction** trained on the obs/model overlap (e.g. quantile delta mapping) and validated out-of-sample — not a baseline period swap. This needs gridded multi-product obs and an expert measure-tune loop; it is not a mechanical change and must not distort the projected trend.
