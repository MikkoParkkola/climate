# fupit Validation Report

This report is generated from `data/trajectory-audit-summary.json` by `npm run report:validation`.
It is intentionally conservative: it records what the current artifact proves, what it flags for scientific review, and what it still cannot prove.

## Artifact

- Audit artifact version: `trajectory-audit-summary-v1`
- Audit artifact generated at: `2026-06-27T21:09:59.405Z`
- Model entry point audited: `grounded_model.py`
- Forecast year range audited: 2025-2100 (76 annual points)
- Fixture cities: 13
- Scenarios: ssp126, ssp245, ssp370, ssp585
- Scenario-place results: 52
- Required contract paths checked: 10

## What This Proves

- The grounded model emitted the expected JSON contract for every audited fixture city, scenario, and annual point.
- Monthly temperature, calibrated monthly temperature, and monthly precipitation arrays were present with 12 finite values.
- Core values stayed inside broad physical sanity ranges for temperature, precipitation, heat-stress days, drought risk, flood risk, and habitability score.
- Raw CMIP6 and IPCC-calibrated temperature fields were both present in the audited responses.

## Observed Baseline Cross-check

- Audit artifact version: `observed-baseline-audit-v1`
- Audit artifact generated at: `2026-06-28T00:48:05.496Z`
- Source checked: WorldClim v2.1 current conditions, 10 arc-minute monthly climatology (1970-2000)
- Fixture cities: 13
- Maximum Python-vs-Node WorldClim annual temperature difference: 0.0039 C
- Maximum Python-vs-Node WorldClim annual precipitation difference: 0.0047 mm
- Near-current projection-year basis: requested 2025 values disclose that the packed scenario source year is 2030.

This cross-check proves that the packaged WorldClim observed baseline is decoded consistently by the Python serving engine and the Node grid reader for the fixture cities. It is baseline provenance evidence, not a claim that the forecast has been historically hindcast against time-varying observations.

## NASA POWER / MERRA-2 observed climatology

- Validation artifact version: `nasa-power-observed-climatology-validation-v1`
- Validation artifact generated at: `2026-06-28T16:52:44.318Z`
- Status: `passed-with-caveats`
- Fixture cities: 13
- Period compared: 1981-2000
- Source IDs: worldclim-v2-1, nasa-power-meteorology-monthly-v10
- Max absolute temperature difference: 1.38 C
- Mean absolute temperature difference: 0.61 C
- Max absolute precipitation difference: 269.9 mm/year
- Mean absolute precipitation difference: 83.72 mm/year
- Review flags: 1

This matrix compares the packaged WorldClim v2.1 observed baseline against NASA POWER monthly point data for `T2M` and `PRECTOTCORR` over the overlapping 1981-2000 period. Monthly precipitation rates are converted from mm/day to annual totals using month-length weighting.

This is observation-backed baseline evidence, not a correction layer and not proof of future projection skill.

| Place | WorldClim temp C | NASA POWER temp C | Diff C | WorldClim precip mm | NASA POWER precip mm | Diff mm | Flags |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Helsinki | 5.19 | 5.27 | -0.07 | 638.99 | 757.24 | -118.26 | none |
| London | 10.56 | 9.79 | 0.78 | 640.21 | 701.46 | -61.24 | none |
| Amsterdam | 9.75 | 9.72 | 0.03 | 840.72 | 827.14 | 13.58 | none |
| Paris | 11.48 | 10.33 | 1.15 | 637.06 | 689.5 | -52.44 | none |
| Prague | 9.35 | 7.97 | 1.38 | 495.86 | 630.18 | -134.33 | none |
| Kyiv | 8.09 | 7.26 | 0.82 | 602.92 | 602.32 | 0.61 | none |
| Bangkok | 28.39 | 27.71 | 0.68 | 1292.75 | 1274.48 | 18.27 | none |
| New York | 12.14 | 11.56 | 0.57 | 1198.85 | 1178.54 | 20.32 | none |
| San Francisco | 14.2 | 13.5 | 0.69 | 796.74 | 666.88 | 129.86 | none |
| Singapore | 26.82 | 26.76 | 0.06 | 2328.57 | 2058.67 | 269.9 | none |
| Mumbai | 27.26 | 26.42 | 0.85 | 2194.72 | 2025.36 | 169.37 | none |
| Cairo | 21.63 | 21.18 | 0.45 | 25.3 | 49.74 | -24.44 | dry-site-relative-precipitation-difference-high |
| Manaus | 26.85 | 26.43 | 0.42 | 2270.39 | 2346.14 | -75.74 | none |

Caveats:

- NASA POWER/MERRA-2 and WorldClim are independent gridded products with different source data, spatial resolution, bias correction, and averaging periods.
- This validates that the packaged observed baseline is broadly consistent with an external observation/reanalysis product for fixture cities.
- This does not validate future CMIP6 scenario trends, local station microclimates, parcel-scale exposure, or historical forecast skill.
- Precipitation differences can be large in dry or coastal-grid locations and should be interpreted as data-product uncertainty, not a correction factor.

## Not a Historical Hindcast

This is not yet a historical future-projection hindcast report. The current artifacts audit forecast trajectory contracts, trend shape from the current baseline year through 2100, packaged WorldClim observed-baseline decoding, and an external NASA POWER observed-climatology comparison. They do not compare past forecast projections against station observations, ERA5, NOAA, or another time-varying historical target.

Until a time-varying projection-vs-observation hindcast matrix exists, Phase 5 validation remains partial. The app can show this report as build evidence, but it must not claim historical forecast skill from it.

## Trend Review Summary

Trend review flags are unresolved scientific-review evidence. They are intentionally visible and are not automatically hidden by green CI.

| Scenario | Meaning | Review items |
| --- | --- | ---: |
| ssp126 | SSP1-2.6 lower-warming full forecast | 13 |
| ssp245 | SSP2-4.5 current-policy-adjacent reference | 2 |
| ssp370 | SSP3-7.0 high-warming pathway | 1 |
| ssp585 | SSP5-8.5 lower-likelihood stress test | 0 |

| Flag type | Count |
| --- | ---: |
| anomalyDown | 15 |
| precipStep | 1 |
| tempDown | 13 |

Interpretation notes:

- `anomalyDown` and `tempDown` are not automatically wrong in a low-warming pathway, because late-century stabilization or decline can be physically plausible. They still require an explanation in the methodology and UI so users do not interpret the graph as a rendering bug.
- `precipStep` identifies a year-to-year precipitation jump large enough to deserve human review before anyone smooths, suppresses, or explains it. Smoothing without a grounded method would be another form of fabricated science.

## Review Items

| Scenario | Place | Flags |
| --- | --- | --- |
| ssp126 | Helsinki | anomalyDown=2071\|2072\|2074\|2076\|2077\|2079\|2081\|2083\|2086\|2088\|2090; tempDown=2072\|2075\|2076\|2079\|2083\|2088 |
| ssp126 | London | anomalyDown=2081\|2082\|2083\|2084\|2085\|2086\|2087\|2088\|2089\|2090; tempDown=2081\|2083\|2084\|2085\|2086\|2087\|2088\|2089 |
| ssp126 | Amsterdam | anomalyDown=2081\|2082\|2083\|2084\|2085\|2086\|2087\|2088\|2089\|2090; tempDown=2081\|2082\|2083\|2084\|2085\|2086\|2087\|2088\|2089\|2090 |
| ssp126 | Paris | anomalyDown=2065\|2081\|2082\|2083\|2084\|2085\|2086\|2087\|2088\|2089\|2090\|2096; tempDown=2066\|2081\|2083\|2084\|2085\|2086\|2087\|2088\|2089\|2091 |
| ssp126 | Prague | anomalyDown=2061\|2062\|2063\|2064\|2066\|2067\|2068\|2069\|2070\|2081\|2082\|2083\|2084\|2085\|2086\|2087\|2088\|2089\|2090; tempDown=2069\|2081\|2082\|2083\|2084\|2085\|2086\|2087\|2088\|2089\|2090 |
| ssp126 | Kyiv | anomalyDown=2061\|2064\|2066\|2069\|2081\|2082\|2083\|2084\|2085\|2086\|2087\|2088\|2089\|2090; tempDown=2066\|2081\|2082\|2083\|2084\|2085\|2086\|2087\|2088\|2089\|2090 |
| ssp126 | Bangkok | anomalyDown=2071\|2074\|2077\|2080\|2092\|2094\|2096\|2099; tempDown=2076\|2079\|2091\|2096 |
| ssp126 | New York | anomalyDown=2063\|2069\|2081\|2083\|2086\|2087\|2089; tempDown=2087\|2088 |
| ssp126 | San Francisco | anomalyDown=2074 |
| ssp126 | Singapore | anomalyDown=2071\|2073\|2074\|2076\|2079\|2080\|2092\|2093\|2095\|2097\|2099\|2100; tempDown=2072\|2075\|2079\|2093\|2095\|2098 |
| ssp126 | Mumbai | anomalyDown=2091\|2092\|2093\|2094\|2095\|2096\|2097\|2099\|2100; tempDown=2091\|2093\|2096\|2098\|2099 |
| ssp126 | Cairo | anomalyDown=2081\|2084\|2087\|2090; tempDown=2081\|2084\|2090 |
| ssp126 | Manaus | anomalyDown=2051\|2052\|2053\|2055\|2056\|2057\|2058\|2059\|2060\|2081\|2084\|2087\|2091\|2092\|2093\|2094\|2095\|2096\|2097\|2098\|2099\|2100; tempDown=2052\|2055\|2056\|2058\|2060\|2081\|2084\|2090\|2092\|2093\|2094\|2095\|2096\|2098\|2099 |
| ssp245 | Helsinki | anomalyDown=2068 |
| ssp245 | Cairo | anomalyDown=2093\|2099; tempDown=2096 |
| ssp370 | Mumbai | precipStep=32.8mm |

## Reproduce

```bash
FUPIT_AUDIT_JSON=1 node scripts/audit-trajectories.mjs > data/trajectory-audit-summary.json
npm run build:observation-validation
npm run report:validation
npm run smoke:validation-report
npm run audit:trajectories
```

## Launch Implication

This report is useful public evidence because it makes the current build auditable and keeps scientific review flags visible. It does not replace the launch blockers in `docs/PLAN.md`: Replit republish, production cache purge/version proof, live verification, live screenshots, and a true time-varying projection-vs-observation hindcast report.
