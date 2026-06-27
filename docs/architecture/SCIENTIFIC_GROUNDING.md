# Scientific Grounding — data sources & methodology

**Rule:** every value served maps to a row in this document — a named dataset, a method, a citation, a license. If a variable isn't grounded here, it isn't shown. (Rams #6 — Honest.)

> Source for the model assessment below: research report 2026-06-26, cross-checked across the cBottle paper (arXiv:2505.06474v2), Earth2Studio docs, Hugging Face/NGC model cards, and IPCC AR6 WGI SPM. Stored in hebb project `climate`.

## The core finding: cBottle is NOT the projection engine

NVIDIA cBottle ("Climate in a Bottle") is a diffusion-based generative emulator of *present/historical* climate, conditioned only on **sea-surface temperature (SST), day-of-year, time-of-day, and a dataset label**. It has:
- **No CO₂, no global-mean-temperature, no SSP/scenario conditioning** — the words "SSP", "2050", "2100", "warming" do not appear in the paper.
- A shipped Earth2Studio data source **hard-capped to 1970–2022**.
- A self-admitted broken trend: *"its long-term trend only half as big as observed."* A model that underestimates the historical trend 2× cannot extrapolate to a +2.7 to +4.4 °C world.
- A **license landmine**: code is Apache-2.0, but the **weights** model-card body says *"governed by the NVIDIA Software and Model Evaluation License Agreement"* and *"for research and development only."* Treat weights as **eval/R&D-only — not cleared for production** until NVIDIA confirms otherwise.

**Verdict:** cBottle is a present-climate *sampler*, not a climate *projection* model. It is optional, supplementary, and currently license-blocked for production. The 2100 signal must come from IPCC AR6 / CMIP6.

## The grounding stack (primary)

| Source | What it provides | Format / access | License |
|---|---|---|---|
| **IPCC AR6 WGI SPM** (Table SPM.1, B.5.3) | Global warming levels & sea-level rise per SSP, with uncertainty ranges | PDF tables (authoritative anchors) | IPCC, citable |
| **Copernicus CDS — Climate Atlas** | Regional/gridded temperature & precipitation by SSP and warming level | NetCDF via `cdsapi`; tidy CSV via [IPCC-WG1/Atlas](https://github.com/IPCC-WG1/Atlas) | Free (CDS account) |
| **Copernicus CDS — CMIP6 / ScenarioMIP** | Raw model projections 2015–2100, all variables, per SSP | NetCDF via `cdsapi`; raw on [ESGF](https://esgf-node.llnl.gov) | Free (CDS account) |
| **NASA AR6 Sea Level Projection Tool** | Per-location sea-level rise, per scenario, 2020–2150, per-process | Per-point download; archive on Zenodo ([5914710](https://zenodo.org/records/5914710), [6382554](https://zenodo.org/records/6382554)) | Open, DOI-cited |
| **WorldClim v2.1 observed climatology** | Present-day monthly land baseline (10 arc-minutes, 1970-2000) | WorldClim GeoTIFFs | Public, citable |
| **CMIP6 historical climatology** | Fallback baseline where observed land baseline is unavailable | Copernicus CDS / CMIP6 | Public |
| **cBottle** (optional, later) | High-res spatial texture / present-climate sampling — **only** if driven by scenario SST; unvalidated; license-gated | HF `nvidia/cbottle` (14.4 GB), self-hosted GPU | **eval/R&D-only** |

## IPCC AR6 anchor numbers (best estimate; very-likely range, °C vs 1850–1900)

Product supports **all five** scenarios (operator decision 2026-06-26).

| Scenario | 2021–2040 | 2041–2060 | 2081–2100 |
|---|---|---|---|
| SSP1-1.9 | 1.5 (1.2–1.7) | 1.6 (1.2–2.0) | 1.4 (1.0–1.8) |
| SSP1-2.6 | 1.5 (1.2–1.8) | 1.7 (1.3–2.2) | 1.8 (1.3–2.4) |
| SSP2-4.5 | 1.5 (1.2–1.8) | 2.0 (1.6–2.5) | 2.7 (2.1–3.5) |
| SSP3-7.0 | 1.5 (1.2–1.8) | 2.1 (1.7–2.6) | 3.6 (2.8–4.6) |
| SSP5-8.5 | 1.6 (1.3–1.9) | 2.4 (1.9–3.0) | 4.4 (3.3–5.7) |

(Subtract ~0.85 °C to express vs a present-day baseline. Source: AR6 WGI SPM Table SPM.1.)

## Model consensus vs IPCC-assessed — make the adjustment visible (operator decision 2026-06-26)

**The "hot model problem"** (Hausfather et al., *Nature* 2022): a subset of CMIP6 models have
higher climate sensitivity than the observed warming record and paleoclimate evidence support.
The IPCC did **not** simply average CMIP6; AR6 assessed warming is constrained toward
observations, so it runs **below the raw multi-model mean**. Our raw 8-model ensemble confirms
this — global-mean ΔT at 2100 (vs 1995–2014, validated 2026-06-26):

| Scenario | Raw ensemble mean | AR6 assessed (~vs 1995–2014) | Gap |
|---|---|---|---|
| SSP1-2.6 | +1.37 °C | ~+0.95 °C | ~+0.4 °C |
| SSP2-4.5 | +2.42 °C | ~+1.85 °C | ~+0.6 °C |
| SSP3-7.0 | +3.70 °C | ~+2.75 °C | ~+0.9 °C |
| SSP5-8.5 | +4.77 °C | ~+3.55 °C | ~+1.2 °C |

**Product decision: surface both numbers and the gap; default to the raw CMIP6 model consensus.**
This is the honesty thesis made literal — show the model consensus, the IPCC assessed
correction, and how much the models are tuned down, so users understand the two are not
the same and can judge the pathway themselves.

**Method (Phase 4/5):**
- The ingest batch stores the **raw ensemble mean + spread** per cell (no change — it already does).
- A thin **calibration layer** computes a per-(scenario, decade) scaling factor
  `k = AR6_assessed_global / raw_ensemble_global` (area-weighted, using the anchor table above
  expressed vs 1995–2014) and stores it. `calibrated_delta = k × raw_delta`.
- Serve the existing temperature headline from raw CMIP6 and include
  `{ model_consensus, ipcc_calibrated, adjustment_c, calibration_factor, modelSpread, method, source }`.
- **Scope honesty:** temperature has clean AR6 assessed anchors → calibrate it. Precipitation /
  other variables have **no** comparable single assessed anchor → show as "model consensus
  + spread," labeled as such; do **not** fabricate a calibration we cannot ground
  (cardinal rule).
- The exact assessed-vs-1995–2014 reference values (not the −0.85 °C approximation) are pinned
  in the Phase 5 validation step before these numbers are served.

## Global mean sea-level rise (m, *likely* range vs 1995–2014) — AR6 SPM B.5.3

| Scenario | by 2100 | by 2150 |
|---|---|---|
| SSP1-1.9 | 0.28–0.55 | 0.37–0.86 |
| SSP1-2.6 | 0.32–0.62 | 0.46–0.99 |
| SSP2-4.5 | 0.44–0.76 | 0.66–1.33 |
| SSP3-7.0 | *not in SPM headline — pull per-location/global from NASA AR6 tool* | *idem* |
| SSP5-8.5 | 0.63–1.01 | 0.98–1.88 |
| Low-likelihood ice-sheet | ~2 m by 2100 | ~5 m by 2150 |

> SSP3-7.0 sea level is **deliberately left blank** rather than guessed — fetch it from the NASA AR6 Sea Level archive during ingestion. Per the cardinal rule: a blank is honest; an invented number is not.

## Per-variable grounding map

| Served variable | Source + method |
|---|---|
| Avg temperature / change | CMIP6 multi-model regional anomaly under chosen SSP, added to WorldClim observed monthly baseline where available; CMIP6 historical fallback otherwise. |
| Precipitation / change | CMIP6 regional precip change %, per SSP, applied to WorldClim observed monthly precipitation where available; CMIP6 historical fallback otherwise. |
| Humidity / change | **Not currently served.** If added, use CMIP6 near-surface relative/specific humidity per SSP and label it as model consensus + spread; do not fabricate an assessed calibration. |
| Sea level / coastal flooding | NASA AR6 Sea Level tool, per-location, per-SSP. |
| Heat-stress / drought / flood risk | Derived from CMIP6 ETCCDI extreme indices (`ingest/fetch_extremes.py`) — **not** from mean fields. Scored at **serve time** against absolute cited thresholds. **See "Risk index grounding (serve-time)" below.** |
| Habitability score & breakdown | Transparent weighted composite of the above — weights documented and shown to the user. Not a hidden black box. |
| Comparable location | Nearest present-day analog by multivariate climate distance over the grounded fields. |
| Uncertainty | Carried end-to-end as the AR6/CMIP6 model spread (range), shown in UI — never collapsed to false precision. |

## Honesty requirements (non-negotiable)

1. Every projection shows **scenario** + **source** + **uncertainty range**.
2. Any value not yet grounded is labeled "estimate — method X" or withheld.
3. A public `/methodology` page documents this stack; `client/public/llms.txt` stays accurate for AI crawlers.
4. No formula ships without a citation in this doc.

## Risk index grounding (serve-time)

**Decision (2026-06-26):** the three risk scores (heat / drought / flood) are computed
at **serve time**, not baked into the cache. The cache carries only the raw ETCCDI
extreme-index *change* (vs 1995–2014) + uncertainty; the serving layer reconstructs the
**absolute** future value and scores it against a documented absolute threshold.

**Why serve-time + absolute:** a precomputed 0–100 needs normalization constants, and an
invented constant presented as science is exactly the failure this product exists to kill.
An absolute threshold (e.g. "days above 35 °C") is citable, stable, and shown to the user
alongside the raw number. The 0–100 is a *transparent presentation* of a cited quantity,
never a hidden black box.

### Data → score pipeline (per hazard)

```
absolute_future(cell, scenario, decade)
    = observed_baseline(cell)            # WorldClim v2.1 1970-2000 climatology where available
      or cmip6_model_baseline(cell)      # 1995-2014 fallback where observed land data is absent
    + ensemble_delta(cell, scenario, decade)   # ingest/extreme-<idx>__<scenario>.nc
score_0_100 = piecewise_linear(absolute_future, threshold_band)   # cited band, below
shown_to_user = { raw_value, unit, threshold_cited, scenario, uncertainty_range }
```

The uncertainty range = the ensemble spread (`delta_std`, `n_models`) carried end-to-end.
Where a cell lacks an observed baseline, the score is withheld (NaN), not guessed.

### Indices fetched and their risk mapping

| Hazard | ETCCDI index (file) | What it is | Absolute threshold (cited) |
|---|---|---|---|
| **Heat** | TXx (`extreme-txx`) | annual hottest-day max temperature, °C | 35 °C heat-stress / 40 °C extreme danger — WHO heat–health guidance; WMO/ETCCDI |
| **Heat** | Tropical nights TR (`extreme-tr`) | nights with Tmin > 20 °C, count/yr | 20 °C night threshold (no physiological recovery) — ETCCDI / WMO; WHO heat–health |
| **Drought** | CDD (`extreme-cdd`) | longest consecutive-dry-day spell (<1 mm), days | ETCCDI CDD; meteorological-drought spell length (UNCCD/WMO drought indicators) |
| **Flood** | Rx5day (`extreme-rx5day`) | max 5-day precipitation total, mm | ETCCDI Rx5day; pluvial-flood proxy (IPCC AR6 WGI Ch.11 heavy-precip assessment) |
| **Flood** | R20mm (`extreme-r20mm`) | days with ≥ 20 mm precipitation, count/yr | ETCCDI R20mm heavy-precip-day count |

Source dataset for all five: **CDS `sis-extreme-indices-cmip6`** (ETCCDI indices derived
from CMIP6, base-independent, annual), 10-model ensemble, SSP1-2.6/2-4.5/3-7.0/5-8.5.
Citation: Sillmann et al. 2013 (ETCCDI index definitions, JGR-Atmospheres); CMIP6
(Eyring et al. 2016). **Provenance caveat:** CDS marks this dataset *"no longer supported
by the data providers… provided as is"* — the index definitions are the published ETCCDI
standard, but the product is frozen; cite as such.

### Honesty constraints specific to risk

1. **No SSP1-1.9** in this dataset — risk is shown for the other four scenarios only; SSP1-1.9 risk is withheld, not interpolated.
2. The score's **scenario, decade, raw index value, unit, threshold, and uncertainty range** are all surfaced — never a bare "78/100".
3. The threshold bands (mapping raw value → 0–100) are documented here before they ship; each band anchors to a cited threshold, and the page `/methodology` reproduces them.
4. Composite habitability never hides a risk component; the breakdown shows each hazard's raw value + score.
