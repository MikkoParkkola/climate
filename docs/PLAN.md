# fupit — project plan

fupit shows the climate of any place on Earth, decade by decade to 2100, and
finds its **climate twin**: the present-day city whose climate today most
resembles that place's future. It is free, needs no signup, and every number
traces to a real source; where the science can't ground a figure, it shows a
blank rather than a guess.

## Current state (shipped)

- Grounded projections from a CMIP6 / IPCC AR6 grid, WorldClim v2.1 baselines,
  NASA / IPCC sea-level data, and ETCCDI extreme-climate indices, served through
  `grounded_model.py` with the raw model consensus and the IPCC-calibrated value
  shown side by side.
- **Climate twin** via sigma-dissimilarity (Mahony 2017) over a 3,000+ city
  Natural Earth reference catalog, with an honest ">4σ = no modern equivalent"
  novelty flag.
- Verdict-first result view: a committed one-sentence outlook, a livability
  runway, "what changes here" cards, an interactive local-mitigation estimate,
  per-metric source receipts, and plain-language scenario controls.
- Per-city share cards and Open Graph unfurls; deep-linkable `/place/<slug>`
  pages with server-rendered SEO.
- Defaults to the 2100 horizon so the first result lands on the payoff.

## Near-term plan

- Widen the reference catalog further and move the twin lookup server-side so it
  can grow without client payload cost.
- A climate-similarity surface (now feasible with the denser catalog).
- Continued honesty + accessibility passes on the result view.

## Principles

- Traceable numbers or a blank — never a confident guess.
- The moderate SSP2-4.5 pathway is the default reference, not a worst case.
- Decision support, not safety-critical advice.

Source and methodology: see `/methodology`, `docs/architecture/`, and the
`README`.
