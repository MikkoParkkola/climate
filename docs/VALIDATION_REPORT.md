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

## Not a Historical Hindcast

This is not yet a historical hindcast report. The current artifacts audit forecast trajectory contracts, trend shape from the current baseline year through 2100, and packaged WorldClim observed-baseline decoding. They do not compare historical projections for past years against NOAA, ERA5, station data, or another time-varying observation product.

Until an observation-backed hindcast matrix exists, Phase 5 validation remains partial. The app can show this report as build evidence, but it must not claim historical forecast skill from it.

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
npm run report:validation
npm run smoke:validation-report
npm run audit:trajectories
```

## Launch Implication

This report is useful public evidence because it makes the current build auditable and keeps scientific review flags visible. It does not replace the launch blockers in `docs/PLAN.md`: Replit republish, production cache purge/version proof, live verification, live screenshots, and a true observation-backed hindcast report.
