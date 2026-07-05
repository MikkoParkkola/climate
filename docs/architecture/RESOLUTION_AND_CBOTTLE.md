# Resolution, local accuracy, and cBottle's real role

**Question (operator, 2026-06-27):** would cBottle improve accuracy for locations that the
current forecast models estimate poorly?

**Short answer: no — not for accuracy.** The weakness it would supposedly fix is a
*baseline resolution* problem, and the correct, free, citable fix is a high-resolution
**observational** baseline (WorldClim/CHELSA at ~1 km) plus, if we want finer *change*
data, **NASA NEX-GDDP-CMIP6** at 25 km. cBottle is license-blocked for production, has no
scenario conditioning, and underestimates even the historical trend by 2×. Its only
defensible role is an optional present-climate visual texture layer, off the accuracy path.

## Diagnose the gap correctly first

Every land location *is* covered by CMIP6 — the grid is global. There is no location with
**no** estimate. The real problem is **sub-grid heterogeneity**: our grid cell is 1°
(~111 km). One cell averages over mountain and valley, coast and inland, city and
countryside. So a mountain town, a small island, or a coastal city gets the cell-average,
which can be several degrees off the true point value.

That error splits into two parts:

1. **Absolute baseline error (large, fixable cheaply).** The present-day value we add the
   change to. Today it is a *model* climatology (1995–2014 CMIP6), which carries local
   biases of a few degrees on top of the coarse resolution. This is the dominant visible
   error for a user comparing "my city today" to reality.
2. **Change-pattern error (small, second-order).** Whether the *warming itself* varies
   within the cell (a ridge warming differently than the valley). Real, but a smaller
   effect than (1), and the hardest thing to ground.

cBottle, if it helped at all, would only touch (2) — and (2) is exactly where it is weakest
(no CO₂/scenario signal, broken trend). It does nothing principled for (1).

## Why a high-res observed baseline beats cBottle for (1)

Our architecture is `absolute = baseline + IPCC-calibrated delta`. The delta is already
observation-constrained. Swap the baseline from "1° model climatology" to a high-resolution
**observed** product and local absolute accuracy jumps, with zero license or trend problems:

| Option | Resolution | Scenario-aware | License | Fixes |
|---|---|---|---|---|
| **WorldClim v2 / CHELSA** | ~1 km | n/a (baseline only) | Free, citable | Baseline error (1) — the big one |
| **NASA NEX-GDDP-CMIP6** | 25 km (0.25°) | Yes, all SSPs, bias-corrected | Free (NASA), citable | Both (1) and (2), 4× finer than now |
| **CORDEX regional models** | 12–25 km | Yes, regional | Free, citable | (2) regionally, heavy to ingest |
| **cBottle** | high-res texture | **No** | **Eval/R&D only** | Neither, honestly |

The boring answer wins: **WorldClim 1 km as the baseline** removes most of the felt
inaccuracy. If we then want finer *projections*, **NEX-GDDP-CMIP6** is a drop-in upgrade for
the delta layer — bias-corrected, all five SSPs, NASA-published. Both are already implied by
the planned "baseline v2" upgrade in `SCIENTIFIC_GROUNDING.md`.

## What cBottle actually is (recap, so this stays decided)

A diffusion-based generative emulator of *present/historical* climate, conditioned only on
sea-surface temperature, day-of-year, time-of-day, and a dataset label. No CO₂, no
global-mean-temperature, no SSP. Earth2Studio data source hard-capped 1970–2022. Self-admitted
trend "only half as big as observed." Weights are NVIDIA eval/R&D-only — **not production
cleared.** (Full evidence: `SCIENTIFIC_GROUNDING.md` §"cBottle is NOT the projection engine.")

A 2× trend underestimate disqualifies it from the change signal. A present-only conditioning
disqualifies it from projecting 2100. Neither is reparable by us.

## Where cBottle could legitimately sit (and only there)

As an **optional present-climate texture/visualization layer**: high-resolution spatial
"look" of today's climate for the map, *driven by observed/reanalysis SST*, never extrapolated
to the future, and only if the weights license is cleared for production. It would make the
map prettier and add fine present-day spatial detail. It would **not** make the 2100 forecast
more accurate. Keep it shelved until (a) the license clears and (b) v1.1 accuracy work
(observed baseline + NEX-GDDP) is done — because that work captures the real accuracy win
without it.

## Recommendation

1. **v1 (now):** ship the 1° CMIP6 grounded grid. Honest and working.
2. **v1.1 accuracy upgrade (the actual answer to the question):**
   - Replace the model baseline with **WorldClim 1 km** observed climatology → fixes local
     absolute accuracy, the dominant visible error.
   - Optionally adopt **NEX-GDDP-CMIP6 (25 km, bias-corrected, all SSPs)** for the delta
     layer → 4× finer, bias-corrected projections.
3. **cBottle:** stays shelved as forecast/accuracy tooling. Revisit only as a license-cleared
   present-climate visual layer. Tracked, not prioritized.

**One-line verdict:** the coverage/accuracy gap is a baseline-resolution problem with a
boring, free, citable fix (high-res *observations*); cBottle is the wrong, license-blocked
tool for it, and pretending otherwise would violate the cardinal rule.
