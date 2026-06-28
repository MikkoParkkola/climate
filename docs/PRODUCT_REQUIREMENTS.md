# Product Requirements - public fupit climate app

**Status:** draft requirements, 2026-06-27.
**Scope:** public educational and research web app for any latitude/longitude, projecting grounded climate and habitability signals to 2100.
**Science boundary:** this document defines what the product must communicate. Source/method authority remains `docs/architecture/SCIENTIFIC_GROUNDING.md`.

## Product promise

fupit should answer one question better than any generic climate site:

> "What does the future climate of this exact place look like, why, how fast is it changing, and what should I not overinterpret?"

The answer must be understandable to a normal person as a **living-conditions roadmap**:
how daily life, seasons, water, heat, cold, flooding, food systems, infrastructure pressure,
and nearby nature may change year by year and decade by decade under different scenarios.

The product is a public education and research exploration tool with auditable projections,
clear uncertainty, and no fabricated science. It is not a property-risk certificate,
insurance model, relocation advisor, city ranking oracle, or disaster prediction system.
Commercial and professional users may use the public app and data, but they receive the same
caveats as everyone else: the output is educational/research context, not certified advice.

## Product goals

1. Raise public climate awareness through personal, place-based projections people want to explore and share.
2. Make climate model output understandable without hiding uncertainty, disagreement, or limits.
3. Support education, journalism, civic learning, open-source review, and lightweight research exploration.
4. Make the work visibly inspectable: methodology, source code, model receipts, validation, and public roadmap should be easy to find.
5. Make scenario differences personally applicable enough to function as a climate-action
   teaching tool: users should see what improves under lower-warming pathways and what worsens
   under higher-warming pathways.

## Research assumptions to keep current

These are product assumptions, not hidden model constants. They must be reviewed whenever
`docs/architecture/SCIENTIFIC_GROUNDING.md` is updated.

- Scenario defaults must reflect the best current synthesis of policy reality, not optimism or
  an unweighted scenario average. As of the 2025 synthesis sources, UNEP's
  [Emissions Gap Report](https://www.pbl.nl/en/publications/unep-emissions-gap-report-2025)
  estimates current policies at about 2.8 C by 2100, while
  [Climate Action Tracker](https://climateactiontracker.org/publications/warming-projections-global-update-2025/)
  estimates about 2.6 C. The app should therefore default to a versioned
  "current-policy reference" pathway mapped to the closest available SSP/warming range.
- Paris-compatible pathways remain essential comparison pathways, but a pathway must not be
  offered as a full living-conditions forecast until every visible metric in that view is
  grounded. Today SSP1-2.6 is the low-emissions full-forecast pathway; SSP1-1.9 remains
  documented context because the packaged ETCCDI extremes source lacks that scenario.
- SSP5-8.5 remains useful as a very-high-emissions / high-end stress test, not as the
  default "most likely" future. The UI should label this distinction plainly.
- [IPCC AR6 WGI](https://www.ipcc.ch/report/ar6/wg1/chapter/summary-for-policymakers/)
  assesses that the Atlantic Meridional Overturning Circulation is very likely to weaken
  during the 21st century, with medium confidence that it will not abruptly collapse before
  2100. AMOC/Gulf Stream content therefore belongs in a tail-risk context layer unless a
  future source directly supports local quantified impacts.
- Candidate enrichment sources must be screened before use, including WRI Aqueduct for
  freshwater risk, [NASA NEX-GDDP-CMIP6](https://www.nccs.nasa.gov/data-collections/nex-gddp-cmip6/)
  for downscaled daily climate variables, GHSL or Natural Earth for ranked population-place
  catalogs, ESA WorldCover/Copernicus land cover for habitat context, GBIF only with license
  filtering for biodiversity occurrences, and FAO/IFPRI-style agricultural datasets only
  after license and method review.

## Personas to satisfy

| Persona | What they came for | What must work for them |
|---|---|---|
| Hometown explorer | Understand how a familiar place changes over a lifetime | Search any place, plain-language storyline, trend-first view, hover explanations |
| Global comparison learner | Compare regions to learn how climate signals differ | Side-by-side trends, climate twins, scenario comparison, clear "educational only" framing |
| Teacher/classroom facilitator | Use place-based climate futures in lessons | Guided comparisons, glossary/tooltips, shareable examples, printable or exportable summaries |
| Student/young learner | Explore climate science through places they recognize | Simple narrative, visual graphs, climate twin metaphor, no jargon without tooltip support |
| Citizen-science data checker | Inspect whether the numbers are credible | Raw JSON, formulas, model version, source links, uncertainty, reproducible methodology |
| Climate researcher/analyst | Rapidly inspect localized projection signals | Scenario selector, annual trajectories, uncertainty bands, source receipts, API access |
| Journalist/science communicator | Tell a grounded place-based climate story | Citation-ready metric receipts, shareable URLs/cards, raw vs assessed model context |
| Biodiversity-curious learner | Understand local ecosystem change | Species/habitat context, ecosystem pressure, clear caveats |
| Civic learning host | Run a public workshop or local climate-literacy session | Non-commercial framing, accessible caveats, exportable educational summary, methodology links |
| Open-source builder/reviewer | Evaluate the engineering and data pipeline quality | Public repo hygiene, clear architecture docs, CI/audit evidence, readable source trail |
| Climate-anxious learner | Get honest context without doom or false reassurance | Clear severity bands, "what changed most," uncertainty, adaptation-aware caveats |

Professional and commercial users are allowed audiences, including analysts, journalists,
educators, builders, and organizations using public educational/research sources. The product
must not, however, optimize around purchase, underwriting, relocation, emergency, or
safety-critical decisions unless future certified datasets and disclaimers support that use.

## Non-negotiable requirements

### R1. Any-location first

- Users can enter any place name or coordinates and receive a forecast when the data stack has coverage.
- The result page must not depend on a fixed list of cities. Fixed catalogs are allowed only for bounded features such as climate twins, examples, global rankings, and smoke tests.
- Fixed catalogs must always disclose coverage, source, version, population/place threshold,
  and why a queried point may not appear in the catalog.
- If local confidence is weak because of coarse grid resolution, coastline ambiguity, high
  elevation, island geography, or missing observed baseline, the UI must say so in the
  metric receipt.
- Same URL state must be shareable: location, scenario, selected year/range, and comparison set.

### R2. Trend graphs beat snapshots

- The primary view is a trend story from the current year through 2100, with 2025 or another documented baseline available as historical context.
- Core graphs must show annual or scientifically finest available resolution for temperature, precipitation, heat stress, drought, flood, sea-level relevance, and habitability.
- If a graph uses interpolation between coarser source years, the tooltip must say the source cadence and interpolation method.
- Graphs must include uncertainty ribbons or ranges when the data layer exposes them.
- Graphs must expose trend rate, not just endpoint delta: per-decade slope, peak/threshold year, and whether the metric is smooth, noisy, or weak-signal.
- Temperature graphs must make raw CMIP6 model consensus and IPCC-assessed/calibrated values visible without hiding the gap.
- Precipitation and derived risk graphs must explicitly communicate higher local uncertainty and possible direction changes.

### R3. Clear storyline per location

Every forecast page must produce a concise, evidence-backed narrative:

1. Current climate baseline.
2. Annual roadmap from the current year to 2100, with decade summaries.
3. Main future driver: heat, cold change, drying, freshwater stress, heavy precipitation,
   flooding, sea level, fire weather, biodiversity pressure, large-scale circulation context,
   or relative stability.
4. Rate of change per decade.
5. Most important threshold crossing or "no major threshold crossed."
6. Best current-day climate analog, if analog confidence is acceptable.
7. Scenario contrast: what changes under lower, reference, and higher warming pathways.
8. What the score does not include.

The user should understand why the habitability score changed without reading the methodology page.

### R3a. Living-conditions translation

Every major metric must have a plain-language "how life changes" interpretation:

- Heat: sleep quality, outdoor work/sport, cooling demand, health stress, school/work disruption.
- Cold: fewer freezing days, winter recreation loss, heating demand, freeze-thaw damage, pests.
- Water: freshwater stress, drought, seasonal reliability, groundwater context where grounded.
- Rain/flood: heavy-rain disruption, drainage pressure, river/coastal caveats.
- Food/agriculture: growing-season shifts, crop/land-cover context, water limits, no invented yields.
- Infrastructure: cooling/heating demand, flood pressure, freeze-thaw, fire weather, coastal exposure.
- Biodiversity: habitat/climate-zone shift, species-pressure context, ecosystem-service implications.

These explanations must be framed as educational context, not personal medical, financial,
engineering, agricultural, or emergency advice.

### R4. Hover tooltips and citations everywhere

- Every displayed metric has a hover/focus tooltip with source, unit, scenario, uncertainty, method, and a one-sentence plain-language interpretation.
- Tooltips must be keyboard and touch accessible, not hover-only.
- Formula-derived values must link to the exact methodology section and show the formula in compact form.
- Citation UI should be lightweight in the main flow: hover receipts, expandable projection receipt, and a full `/methodology` page for deep audit.
- Tooltips must distinguish raw model output, assessed/calibrated output, observed baseline, and derived presentation score.

### R5. Derived scores must be auditable or demoted

- Habitability, drought risk, flood risk, heat stress, and climate twin distance must expose their inputs and formula.
- Scores should use bands or rounded values when precision is not scientifically meaningful.
- The UI must separate "raw grounded metric" from "presentation score."
- If a field cannot be grounded for a location, the app withholds it or labels the missing reason. It must not fill with plausible guesses.

### R5a. Biodiversity must be grounded and humble

- Biodiversity is first-class because it affects ecosystems, food systems, pests, pollination,
  fisheries, forests, cultural landscapes, and human wellbeing.
- The app may show biodiversity pressure only from documented datasets or transparent climate
  proxies such as biome shift, habitat exposure, protected-area context, land cover, heat,
  drought, and fire-weather change.
- The app must not predict local extinctions, species collapse, or ecosystem failure unless a
  cited biodiversity model directly supports that exact claim.
- Biodiversity tooltips must explain why it matters in everyday terms: pollinators, shade,
  forests, water regulation, soil, pests, disease vectors, fisheries, and loss of familiar nature.

### R5b. Enrichment data must pass a source and license gate

No enrichment layer may be shown, exported, or used in ranking until it has a documented
registry row in `docs/architecture/SCIENTIFIC_GROUNDING.md` or a successor source registry.

The registry row must include:

- Dataset name, provider, version/date, DOI or stable URL, and citation text.
- License, attribution duties, redistribution limits, and whether public/commercial reuse is compatible with the app's allowed-use posture.
- Spatial resolution, temporal resolution, scenario coverage, variables used, update cadence, and known blind spots.
- Exact transformation method from source variable to displayed metric, including units, uncertainty/range handling, and thresholds.
- Missing-data behavior: suppress, caveat, or show "not available"; never fill gaps with plausible estimates.

Data carrying non-commercial, no-redistribution, or ambiguous terms must be excluded from
public API/download output unless legal review explicitly approves the use and the UI
prevents downstream misuse.

### R6. Coastal and inland logic must not mislead

- Sea-level rise is shown as locally relevant only when the location is coastal or otherwise exposed by a documented coastal-relevance method.
- Inland locations can show regional sea-level context only behind an explicit caveat, or suppress the card by default.
- Flood risk must be framed as a climate-heavy-precipitation proxy unless local hydrology, drainage, river, and elevation data are added.

### R6a. Large-scale circulation context must not overclaim

- AMOC/Gulf Stream content must be presented as regional context and tail risk, not as a
  deterministic local forecast.
- The default copy must say both sides of the science: weakening is expected; abrupt
  collapse before 2100 is not the central IPCC assessment; consequences would be serious if
  it occurred.
- AMOC/Gulf Stream context may affect the storyline for North Atlantic, European, Arctic,
  West African monsoon, and related regions only when the cited source supports that linkage.
- The app must not say "London freezes," "Europe becomes safe," or any similar viral claim
  unless a cited model directly supports the exact statement.

### R7. Scenario comparison must be understandable

- The scenario selector uses plain labels plus scientific IDs, such as "middle pathway (SSP2-4.5)."
- Users can compare at least low, middle, and high pathways without losing their location/search state.
- The default scenario must be a versioned "current-policy reference" chosen from cited
  policy-tracking literature and mapped to the closest available SSP/warming range in the
  methodology. It must not be a hidden average of scenarios.
- The app must avoid declaring a single scenario as prophecy. A default is a reference
  pathway, not a prediction.
- The educational storyline must explain which scenarios the scientific community treats as
  central/current-policy, Paris-compatible, stress-test, or lower-probability pathways without
  hiding raw model output.
- If current-policy literature moves materially, the default label and methodology version
  must be updated together.
- Scenario comparison must make the call to action visible without preaching: show the local
  difference between lower-warming and higher-warming futures in concrete living-condition terms.

### R7a. Global top-10 rankings must teach, not sensationalize

The app should include global top-10 lists for cities, population centers, and countries where
the catalog/source supports the claim.

Current implementation status: `/rankings` supports curated example places, Natural Earth
1:110m populated places with `pop_max >= 3,000,000`, and a bounded country aggregate derived
from those included Natural Earth points weighted by `pop_max`. That country aggregate is not
full national exposure, rural exposure, area-average climate, or GHSL population-weighted
country exposure.

Required ranking dimensions:

- Year and scenario.
- Metric: heat stress, warming rate, drought/freshwater stress, heavy-rain/flood pressure,
  sea-level exposure for coastal places, cold-stress decline, biodiversity/habitat pressure,
  habitability-score change, and "relative less-exposed" locations.
- Direction: most worsened, most improved/less exposed, and largest uncertainty where useful.
- Catalog type and sample size: urban centers, curated cities, countries, or population-weighted regions.
- Source, rank formula, tie handling, uncertainty/range, and exclusion rules.

Ranking copy must avoid "winner/loser" absolutism when the score omits adaptation,
governance, wealth, migration, conflict, healthcare, and infrastructure quality. Prefer
"relative less-exposed in this metric" over "safe."

### R8. cBottle/DGX Spark role is research-gated, not headline science

- cBottle may be explored on DGX Spark only as a research/downscaling or present-climate sampling layer.
- cBottle must not originate 2050/2100 trend signals unless future work proves scenario conditioning, hindcast skill, and production permission.
- Any cBottle-derived layer must ship only after:
  - public production use is allowed,
  - hindcast validation beats the current baseline/delta stack,
  - it preserves the IPCC/CMIP6 scenario signal,
  - methodology documents exactly what it improves and what it cannot improve.
- Higher priority accuracy upgrades remain observed high-resolution baselines and bias-corrected scenario data, especially WorldClim/CHELSA and NASA NEX-GDDP-CMIP6.

### R9. Public repo and launch hygiene

Before making or advertising the GitHub repo as public:

- Run a professional public-readiness audit over the current tree and commit history.
- Remove stale merge artifacts, dead fabricated science code, misleading docs, old private notes, generated logs, and scratch files that make the project look careless.
- Ensure `README.md`, `/methodology`, `docs/PLAN.md`, `docs/architecture/*`, `LICENSE`, `SECURITY.md`, and contribution notes are coherent and public-facing.
- Ensure issue templates, roadmap labels, and project docs make the repository look intentionally run, not abandoned.
- If history contains material that should not be public, rewrite history only with explicit owner approval and a migration note.
- No public claim says "accurate for any property" or "predicts safety"; use "grounded projection," "education," and "research exploration."

### R10. Viral, awareness, and showcase layer

The app should be shareable because the result is personal, educational, and inspectable:

- One-click share card: "My city in 2100 looks most like X today" plus key trend driver.
- Social image generation for shared URLs with location, scenario, climate twin, and top risk driver.
- Comparison prompts that invite learning, such as "Why does Helsinki warm faster than London?" or "Why is Bangkok already heat-stressed?"
- Public methodology and GitHub source links visible enough that technical users can inspect the engineering quality.
- Source attribution must be tasteful and transparent: footer, methodology, source trail,
  share page, and about section are appropriate; blocking modals or sales copy in the
  climate result flow are not.
- Performance should feel instant after first query; if a forecast is computing, show progress and cache status honestly.
- Mobile must be first-class: search, trend scrubber, tooltips, and sharing cannot require desktop hover.

## Feature requirements

### F1. Forecast result page

Must show:

- Place name and coordinates.
- Scenario and model version.
- Current-year baseline and selected future year.
- Temperature, precipitation, heat stress, drought, flood, sea-level relevance, and habitability.
- Freshwater, cold stress, humid heat, fire weather, food/agriculture pressure, infrastructure
  pressure, and biodiversity pressure when grounded data is available.
  Status: humid heat is partially implemented as a CMIP6 relative-humidity plus Stull 2011
  monthly mean wet-bulb screen; daily humid-heat exceedance days and WBGT remain future
  until grounded daily/weather-exposure data exists.
- AMOC/Gulf Stream or other large-scale circulation context when relevant and cited, clearly
  separated from local metric projections.
- Trend graphs as the default; year snapshot as a derived detail.
- Projection receipt with data sources, uncertainty, cache/generated timestamp, and model version.
- "What this does not mean" caveat near the receipt.
- Plain-language living-condition summary for normal readers.

### F2. Trend graph quality

Acceptance criteria:

- No graph has fewer than annual points if annual model/interpolated values are available.
- Every line chart has legible axes, units, scenario label, uncertainty/range affordance, and tooltip value at each point.
- Important thresholds are marked directly on the graph when documented: heat-stress bands, sea-level ranges, risk bands.
- The chart must not imply false precision: rounded labels, range bands, and trend annotations are preferred over dense decimals.
- Comparison mode must not place banners, overlays, or sticky elements over sliders or chart interaction controls.

### F3. Climate twin

- Climate twin works for any queried location, but its candidate set is explicitly bounded to the current analog catalog until a global analog index exists.
- The output shows closest match, distance, method-specific match band, temperature gap, precipitation gap, heat-stress gap, and "no close analog" when appropriate.
- The twin must be framed as a communication aid, not a scientific equivalence claim.
- Public API behavior: `GET /api/climate-twin` returns the bounded catalog id/version/year, compared count, alternatives, distance components, deltas, source receipt, and caveats. It must reject unsupported full-forecast scenarios rather than fill missing risk layers.

### F4. Explainability layer

- Every card has a short main insight sentence.
- Every metric has a tooltip receipt.
- A "why this changed" section ranks the top contributors to score change.
- A "what this means for daily life" section translates climate signals into normal language.
- The methodology page has stable anchors so tooltips can deep-link to exact methods.

### F5. Data/API requirements

- Public API responses include scenario, model version, source/method metadata, uncertainty, and cache version.
- API contract supports annual trajectory requests efficiently.
- Cache keys include location, rounded coordinate policy, year, scenario, and model/cache version.
- Old incompatible cache rows must never be served.
- Raw JSON is available for skeptical users through a copy/download control or documented API route.

### F6. Global rankings view

- Ranking endpoint/UI supports top-10 lists by metric, year, scenario, and catalog type.
- Every ranking row links to a source receipt and explains why the location is included.
- Country rankings are population-weighted, population-place weighted, or explicitly labelled as country-average where appropriate.
- City/population-center rankings use an auditable catalog such as GHSL urban centers,
  Natural Earth populated places, or a documented curated list.
- Bounded country aggregates must disclose the included-place sample size, weighting field,
  excluded countries, and why the result is not full national exposure.
- The ranking view includes uncertainty or "weak signal" labels and never hides tied or
  near-tied values behind false precision.

### F7. Enrichment module acceptance criteria

Each enrichment module must pass these checks before public display:

| Module | Minimum grounded output | Must not claim |
|---|---|---|
| Freshwater | Basin/cell water stress, seasonal variability, baseline/future comparison, source year/scenario | Household tap reliability or legal water rights |
| Food/agriculture | Cropland/crop context, growing-season or heat/water pressure, caveated scenario trend | Crop yield, food prices, famine, or farm profitability |
| Storm/extreme weather | Documented ETCCDI or hazard index trend, unit, uncertainty, source cadence | Individual storm tracks, insured losses, or event prediction |
| Infrastructure | Climate pressure proxies for cooling, heating, flood, freeze-thaw, fire weather, or coastal exposure | Building-level engineering risk or asset value |
| Biodiversity | Land-cover/habitat context, biome or climate-zone shift, occurrence/protected-area context where license allows | Local extinction, abundance collapse, or ecosystem failure without a direct model |
| AMOC/Gulf Stream | Regional tail-risk explanation with confidence level and cited source | Deterministic local cooling/warming correction or collapse date |

### F8. Public credibility requirements

- Root README explains what the app does, what data it uses, how to run it, and what its limits are.
- Methodology page is crawlable without client-side JavaScript.
- `llms.txt`, sitemap, Open Graph, and structured data identify fupit and the public source trail.
- CI or documented local validation includes typecheck, build, model contract smoke, trajectory audit, data-quality artifact smoke, and live verification after deploy.

## Launch acceptance criteria

The app is public-launch ready when:

- No public route serves fabricated legacy projections.
- A fresh forecast endpoint smoke passes against production-style data storage.
- Production cache is purged or version-guarded so old rows cannot surface.
- Main result and comparison flows work on desktop and mobile screenshots.
- Every visible metric has source/caveat access through tooltip, receipt, or methodology link.
- Trend graphs show annual/fine-grained trajectories and uncertainty where available.
- Sea-level/flood presentation does not imply parcel-level or inland precision.
- Scenario default has a versioned current-policy source and visible explanation.
- Global rankings disclose catalog, sample size, rank formula, uncertainty, and exclusions.
- Enrichment layers have source/license registry rows and suppress missing or legally unsafe data.
- AMOC/Gulf Stream context is caveated as regional tail-risk context, not a local forecast.
- GitHub repository passes public-readiness review.
- `npm run ci` passes locally; remote CI status is explained if externally blocked.

## v1.1 accuracy and credibility backlog

1. Replace coarse baseline with higher-resolution observed climatology where not already active, and document cell-level confidence.
2. Evaluate NASA NEX-GDDP-CMIP6 as a finer, bias-corrected delta layer.
3. Add coastal-relevance/elevation gating for sea-level and coastal flood cards. Status: partial; result-page sea-level wording now uses a Natural Earth 1:110m nearest-coast screen with source receipts and inland/regional caveats, but true elevation, storm-surge, tides, subsidence, defenses, drainage, river, and parcel-exposure gating remains future work.
4. Add exportable classroom/journalist/researcher report. Status: initial Markdown educational summary is implemented from visible grounded fields, annual roadmap, climate twin, source trail, and caveats; richer printable classroom mode remains future work.
5. Expand the public data-quality dashboard from the current trajectory validation report to a true observation-backed hindcast matrix, then add live-deploy evidence after Replit publish/cache purge. Status: partial; `/data-quality` and `docs/VALIDATION_REPORT.md` now include a NASA POWER/MERRA-2 observed-climatology baseline comparison for the 13 fixture cities, but this is not a time-varying future-projection hindcast or correction layer.
6. Research cBottle on DGX Spark only after permission clearance and with a written validation protocol.
7. Add share-card image generation and social previews.
8. Add guided classroom/explainer mode. Status: implemented on the result page as a guided explainer that walks users through trend-first reading, daily-life questions, score drivers, pathway/twin comparison, evidence limits, and classroom prompts using only visible forecast fields.
9. Add scenario comparison small multiples for all key metrics. Status: implemented in the result-page scenario contrast with raw warming, IPCC assessed warming, heat-stress days, rainfall change, drought risk, flood risk, sea-level context, and habitability score; each panel discloses same-coordinate SSP trajectories and annual interpolation between grounded checkpoints.
10. Add transparent score sensitivity: show how habitability changes when weights are adjusted or hidden. Status: implemented in the result-page explainability section as an interactive what-if over the visible habitability breakdown; checkboxes hide components, sliders adjust already-weighted component multipliers, and the panel discloses the clamp formula plus missing-domain limits.
11. Add a source/license registry table for all enrichment datasets before new metrics are exposed. Status: implemented on `/data-quality` for the current `data/source-registry.json` rows, including license, commercial reuse, redistribution, method, coverage, display policy, and the rule that unregistered sources cannot produce public metrics/rankings/exports. `/data-quality` also shows an enrichment readiness ledger that marks partial/context-only domains separately from withheld domains such as freshwater, cold stress, fire weather, agriculture, infrastructure, and biodiversity.
12. Add global top-10 rankings for urban centers, countries, and population-weighted regions. Status: partially implemented with curated-city rankings, Natural Earth populated-place rankings, and a Natural Earth-derived country aggregate weighted across included `pop_max >= 3,000,000` populated-place points. True GHSL urban-center, full national exposure, rural exposure, and population-weighted regional/country artifacts remain future work.
13. Add freshwater risk using a legally compatible global dataset with baseline/future indicators.
14. Add biodiversity pressure using documented datasets or transparent climate/habitat proxies.
15. Add AMOC/Gulf Stream regional context layer with confidence labels and no deterministic local correction.
16. Add a one-year-granularity living roadmap view with decade summaries and scenario deltas.

## Non-goals

- No sales positioning or paid-product framing for the climate app.
- No ads, paywalls, or promotional pitch inside the climate result flow.
- No parcel-level real-estate risk certificate.
- No emergency, insurance, medical, agricultural, or legal advice.
- No undisclosed heuristic climate numbers.
- No future projection sourced solely from cBottle.
- No "safe city," "climate haven," or "winner" claim without narrow metric-specific caveats.
- No claim that a single habitability score captures politics, healthcare, cost of living, adaptation, infrastructure, migration, or conflict.
