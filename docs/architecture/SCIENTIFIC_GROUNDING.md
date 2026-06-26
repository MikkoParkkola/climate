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
| **NOAA / observational climatology** | Present-day baseline (already used) | NOAA CDO API | Public |
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

**Product decision: surface both numbers and the gap; default to the IPCC-calibrated value.**
This is the honesty thesis made literal — show the model consensus, the IPCC correction, and
how much the models are tuned down, so users understand the two are not the same.

**Method (Phase 4/5):**
- The ingest batch stores the **raw ensemble mean + spread** per cell (no change — it already does).
- A thin **calibration layer** computes a per-(scenario, decade) scaling factor
  `k = AR6_assessed_global / raw_ensemble_global` (area-weighted, using the anchor table above
  expressed vs 1995–2014) and stores it. `calibrated_delta = k × raw_delta`.
- Serve `{ modelConsensus, ipccCalibrated, adjustment, adjustmentPct, modelSpread, method, source }`.
- **Scope honesty:** temperature has clean AR6 assessed anchors → calibrate it. Precipitation /
  humidity have **no** comparable single assessed anchor → show as "model consensus + spread,"
  labeled as such; do **not** fabricate a calibration we cannot ground (cardinal rule).
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
| Avg temperature / change | CMIP6 multi-model regional anomaly under chosen SSP, added to NOAA baseline. Atlas for region aggregation. |
| Precipitation / change | CMIP6 regional precip change %, per SSP. |
| Humidity / change | CMIP6 near-surface relative/specific humidity, per SSP (if available; else mark estimate). |
| Sea level / coastal flooding | NASA AR6 Sea Level tool, per-location, per-SSP. |
| Heat-stress / drought / flood risk | Derived indices from CMIP6 fields with **documented formulas** (e.g. days over threshold). Each formula cited; no magic constants. |
| Habitability score & breakdown | Transparent weighted composite of the above — weights documented and shown to the user. Not a hidden black box. |
| Comparable location | Nearest present-day analog by multivariate climate distance over the grounded fields. |
| Uncertainty | Carried end-to-end as the AR6/CMIP6 model spread (range), shown in UI — never collapsed to false precision. |

## Honesty requirements (non-negotiable)

1. Every projection shows **scenario** + **source** + **uncertainty range**.
2. Any value not yet grounded is labeled "estimate — method X" or withheld.
3. A public `/methodology` page documents this stack; `client/public/llms.txt` stays accurate for AI crawlers.
4. No formula ships without a citation in this doc.
