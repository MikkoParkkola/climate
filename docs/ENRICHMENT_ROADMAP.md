# Enrichment Roadmap — grounding the remaining habitability signals

> Companion to `PLAN.md`. PLAN.md took fupit from fabricated to grounded and through launch.
> This doc covers the **next chapter**: filling the habitability signals still marked `partial`,
> `context-only`, or `withheld` in `server/data-quality.ts` (`ENRICHMENT_READINESS`), each with a
> real, licensed, lat/lng-resolvable dataset. Freshwater (WRI Aqueduct 4.0) was the first; it set
> the pattern this doc generalizes.

## Governing constraints (read before adding any source)

1. **Cardinal rule.** Every served number traces to a real, citable source. No invented
   coefficients. If a value can't be grounded, do not show it — show a labeled gap instead.
2. **Project is NON-COMMERCIAL** (operator, 2026-06-29). License bar = non-commercial use +
   public display/redistribution of *derived* output. CC-BY-NC, research-only, and IUCN-style
   terms are acceptable. Any source usable **only** because of non-commercial status is tagged
   `NC-ONLY` and must be removed if fupit ever monetizes.
3. **Scenario honesty.** Map a source's scenarios to ssp126/245/370/585. Where a source has no
   matching scenario, return `null` — never approximate (the freshwater ssp245 precedent).
4. **Confirm-before-serve.** Any license marked `[I]` (single-source) gets read on the provider's
   own page before a number ships. The freshwater discipline, not optional.

## The freshwater recipe (repeat per source)

Every integration is the same 8 steps. Freshwater (`server/freshwater.ts`,
`scripts/build_aqueduct_freshwater.py`) is the reference implementation.

1. **Build script** `scripts/build_<source>.py` — download raw to `.<source>-build/` (gitignored),
   reduce to a compact lookup grid, write `data/<signal>.<source>.{json,u16.gz}` (or int16 packed
   like `grid.i16.gz`). Add the raw staging dir to `.gitignore`.
2. **Server lookup** `server/<signal>.ts` — module-memoized load + gunzip, size-validated raster,
   nearest-cell fallback, scenario map, honest `null` returns. Mirror `freshwater.ts` exactly.
3. **Wire** into the climate endpoint in `server/routes.ts` with a try/catch → `null` fallback.
4. **Source registry** entry in `data/source-registry.json`: provider, DOI/URL, citation, license,
   `commercialReuse`/`redistribution`, scenario coverage, method, displayPolicy, caveat, reviewedAt.
5. **Data-quality** — flip the signal's status in `ENRICHMENT_READINESS` and fill `groundedBasis` +
   `missingForFullUse`.
6. **Smoke test** `scripts/smoke-<signal>.ts`; wire into the `ci` script in `package.json`.
7. **Methodology** page — add the grounding + caveat to `client/src/pages/methodology.tsx`.
8. **UI** — surface the value on the result page with its caveat; never overclaim resolution.

Verify in layers (endpoint JSON + `npm run build` + screenshot), never one heavy e2e. Build the
heavy reductions on Spark, not the Mac.

## Prioritized integrations

### E1 — NASA NEX-GDDP-CMIP6 (closes 3 gaps) — HIGHEST LEVERAGE

One dataset grounds **humid_heat (daily), cold_season (daily), and infrastructure degree-days**.

- **Source:** NASA NCCS Earth Exchange. DOI `10.7917/OFSG3345`. `s3://nex-gddp-cmip6` (AWS Open Data).
- **License:** **CC0** (verified verbatim on AWS registry, blanket since Sept 2022). Public domain —
  safe even if the project later monetizes. The one pick with zero license risk. **[V]**
- **Data:** daily `tasmax/tasmin/tas/hurs/huss/pr/sfcWind/rsds/rlds`, 0.25° (~25 km), 1950–2100.
- **Scenarios:** ssp126/245/370/585 — all four, no nulls.
- **Method:**
  - *humid_heat*: daily wet-bulb via **Stull (2011)**, DOI `10.1175/JAMC-D-11-0143.1` (published
    formula, not invented). Count exceedance days (Tw > 28/31/35 °C) per cell/SSP/window.
  - *cold_season*: ETCCDI indices from daily fields — frost days (tasmin<0), ice days (tasmax<0),
    TNn (annual min tasmin), cold-spell duration. WMO-standard definitions.
  - *infrastructure (part)*: cooling/heating degree-days from daily `tas`.
- **Build note:** full archive ~38 TB — do **not** ship it. Batch-reduce on Spark to exceedance/index
  counts per cell × SSP × window, pack into the existing `grid.i16.gz` int16 format the Node engine
  already reads. One pass over the daily files yields both humid-heat and cold indices.
- **Caveat:** "~25 km downscaled ensemble; wet-bulb via Stull approximation — a regional humidity-heat
  screen, not measured WBGT (which also depends on sun and wind)."
- **Pre-build check:** `aws s3 ls --no-sign-request s3://nex-gddp-cmip6/NEX-GDDP-CMIP6/` to confirm the
  `hurs`/`huss` field names. `[I]` on exact names; everything else `[V]`.

### E2 — WRI Aqueduct Floods (infrastructure exposure)

- **Source:** WRI, Aqueduct Floods (Ward et al. 2020). AWS `s3://wri-projects/Aqueduct`.
- **License:** **CC-BY 4.0** (WRI Open Data Commitment) — the same family already cleared for
  freshwater, so no new legal review. **[V-leaning; confirm the per-dataset tag on datasets.wri.org]**
- **Data:** riverine + coastal flood depth, population exposure, GDP/property exposure, expected annual
  damage. ~1 km (30 arc-sec), future periods 2030/2050/2080.
- **Scenarios:** RCP4.5 → serve as ssp245, RCP8.5 → serve as ssp585. **ssp126/ssp370 → null.**
- **Caveat:** "Modeled regional flood exposure at ~1 km; depends on assumed protection standards. Not a
  property-level guarantee."
- Pairs with E1's degree-days to form the full `infrastructure` signal (flood exposure + thermal load).

### E3 — ISIMIP GGCMI crop yields (food_agriculture)

- **Source:** ISIMIP (PIK), GGCMI phase 3. **License: CC0 1.0** (verified ISIMIP3 terms) + attribution
  request + recent-round embargo; derived redistribution allowed. **[V license; confirm embargo status]**
- **Data:** yields (maize/wheat/rice/soy), 0.5°, multi-model, to 2100.
- **Scenarios:** ssp126/370/585. **ssp245 not in core protocol → null** (matches freshwater pattern).
- **Optional second layer (NC-ONLY):** FAO/IIASA **GAEZ v4**, ~9 km, finer detail. Usable only because
  the project is non-commercial; confirm the portal permits online display of derived output. Tag
  `NC-ONLY`.
- **Caveat:** "Model-ensemble crop signal, not a field-level yield forecast."

### E4 — Quilcaille 2023 global fire-weather (fire_weather)

- **Source:** Quilcaille et al., ESSD 2023. DOI `10.3929/ethz-b-000583391`. Code `10.5281/zenodo.7971275`.
- **License:** CC-BY 4.0 (article is unambiguous; **confirm the exact label on the ETH record** — page
  was bot-blocked). **[I — confirm before serve]**
- **Data:** annual FWI indicators — max FWI, extreme-fire-weather days, fire-season length, seasonal-avg
  FWI; 2.5° (~250 km), 1850–2100, 28 CMIP6 models.
- **Scenarios:** ssp119/126/245/370/585 — full coverage, no nulls.
- **Fallback:** compute the Canadian FWI (Van Wagner & Pickett 1987 official equations) from E1's
  NEX-GDDP inputs — defensible, public-domain. Use if the Quilcaille license doesn't confirm.
- **Caveat:** "Coarse ~250 km annual fire-weather trend; indicates fire-conducive weather, not ignition
  or fuel/management."

### E5 — Sea-level upgrades (sea_level_local_relevance)

Three sub-layers, three verdicts — not one source.

- **Subsidence (ALREADY GROUNDED):** `ingest/fetch_sealevel.py` already ingests the AR6 **`total`
  component WITH vertical land motion** (regional relative sea level, the number a coast actually
  experiences) — broad coastal land-sinking is already captured. No work needed. Fine-scale
  groundwater hotspots (Jakarta/Houston-class) have no open global product and stay a declared gap.
- **Elevation:** NASADEM or Copernicus GLO-30 (both open). Caveat: these are *surface* models (include
  buildings/trees), so they bias coastlines toward looking safer — label "surface elevation," not
  "ground height." **Reject** CoastalDEM (paid) and MERIT DEM (share-alike license — would infect the
  codebase).
- **Storm surge:** Copernicus CDS sea-level indicators, CC-BY, but **SSP5-8.5 and ≤2050 only** → maps
  to ssp585 mid-century, null elsewhere. Usable but narrow; free CDS account needed to download (not a
  redistribution blocker).

## Honest gaps — declare, do not fake

- **Global biodiversity *projection*.** No clean global SSP-scenario dataset exists. IUCN range data is
  now usable (NC-ONLY) as **present-day context**, and RESOLVE Ecoregions (CC-BY) as static habitat
  context — but neither is a future projection. Keep the projection number **withheld**; show labeled
  present-day context at most. Forcing a future biodiversity number breaks the cardinal rule.
- **Fine-scale land subsidence.** Only broad VLM via AR6 (E5); local pumping hotspots have no open
  global product. State it.

## License confirm-before-serve checklist

| Source | License | Status |
|--------|---------|--------|
| NEX-GDDP-CMIP6 | CC0 | confirm NCCS data-use page (load-bearing) |
| ISIMIP GGCMI | CC0 + embargo | confirm current terms + embargo window |
| Quilcaille FWI | CC-BY 4.0 | confirm exact label on ETH record |
| Aqueduct Floods | CC-BY 4.0 | confirm per-dataset tag on datasets.wri.org |
| IUCN ranges (NC-ONLY) | non-commercial | confirm public-display-of-derived-output clause |
| GAEZ v4 (NC-ONLY) | FAO restricted | confirm online-republication of derived output |

## Sequencing

1. **E1 NEX-GDDP first** — three gaps, CC0, future-proof, one pipeline. Biggest move.
2. **E5 subsidence — DONE** (AR6 `total`/with-VLM already ingested; verified 2026-06-29). E5b/c
   (elevation, surge) remain for finer sea-level detail.
3. **E2 Aqueduct Floods** — reuses cleared license, completes infrastructure with E1's degree-days.
4. **E3 agriculture**, then **E4 fire** — independent, lower urgency.
5. **Biodiversity** — keep withheld; add static context only if desired.

## Out of band (not enrichment, but blocking launch)

- **Replit republish + live verification** — PLAN.md "Phase 4 handoff". Landed code (freshwater,
  dark-theme, anti-ai-tell visual) is on `main` but not yet live; users see the old site.
- **Production `climate_model_cache` purge/version-guard proof** on Replit-class infra.
