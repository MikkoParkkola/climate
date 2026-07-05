# Tech Design — User Customization Knobs ("Your conditions")

**Status:** design + core implementation. **Owner:** fupit. **Constraint:** extreme speed, viral scale.

## The one decision that matters

**Score on the client. Never round-trip a knob to the server.**

The habitability score is a *transparent linear function* (`grounded_model.py::habitability`): a comfort base minus cited hazard penalties. Every input it needs — annual mean temp, annual precip, tropical nights, drought, flood, wet-bulb — is **already in the trajectory the server returns once per location**. The only free parameter is the user's comfort preference.

So the expensive work (sampling the grounded CMIP6/IPCC grid) happens **once per (lat, lng, scenario), cached**. Re-scoring for a knob change is a pure function over ~16 checkpoint years — **sub-millisecond, zero network**. A million users dragging sliders adds **zero** server load.

```
        ┌─ server (expensive, cached, rate-limited) ─┐   ┌─ client (free, instant, infinite) ─┐
 once:  │ grid sample → raw vars per year → cache    │ → │ habitability(rawVars, prefs) → score │ per keystroke
        └────────────────────────────────────────────┘   └──────────────────────────────────────┘
```

This is the viral-scale property: **personalization is free because it's local.** No new endpoint, no cache pressure, no per-tweak cost.

## The parity contract (load-bearing)

The client scorer is an *exact port* of the Python `habitability()`. If they drift, the personalized score lies. Two guards keep them locked:

1. **Static self-check** (`lib/habitability.ts::_selfCheck`) — known inputs → expected score, runs in CI/`tsx`.
2. **Runtime parity assertion** (dev only) — when a trajectory loads, for each point assert `habitabilityTS(rawVars, DEFAULT_PREFS).score ≈ point.habitability.score` (the server's value) within ε = 0.6 (the rounding). Any divergence logs loudly. This validates the port against **live** data on every forecast, free.

Single source of truth for the constants: `grounded_model.py` lines 88–104. The TS copy carries a comment pointing back, and the parity assertion is the enforcement.

## Honesty rule (THE CARDINAL RULE)

`grounded_model.py:92` is explicit: *"user-adjustable; rankings use the default."* Therefore:

- **Default prefs → byte-identical to the server score.** The grounded, citeable number is the default.
- Personalized scores are labeled **"your view"** in the UI — a lens, never a claim that overrides the grounded default. Global rankings, shared science, and the methodology page always use defaults.
- Knobs change *weighting of preference*, never the underlying grounded hazard values. We never invent data; we re-weight cited components.

## The knobs (`Prefs`)

Sensible defaults = the Python constants, so 95% never open the drawer and their score == the canonical one.

| Knob | Param | Default | What it changes |
|---|---|---|---|
| Ideal temperature | `comfortOptimumC` | 20°C | Center of the comfort plateau |
| Heat vs cold tolerance | `heatSlope` / `coldSlope` | 3.5 / 3.0 | How fast comfort falls above/below the band |
| Water sensitivity | `droughtWeight` | 0.25 | Drought penalty steepness |
| Flood sensitivity | `floodWeight` | 0.25 | Heavy-rain/flood penalty steepness |
| Coastal concern | `coastalConcern` | auto | Sea-level emphasis (auto-off inland) |

v1 ships the highest-signal knob (`comfortOptimumC`) plus heat/cold tolerance; the rest are wired in the same `Prefs` object and exposed as the drawer grows. Adding a knob = one field + one slider, no architecture change.

## State + the viral mechanic

- `Prefs` lives in a shared client store (`lib/use-prefs.ts`), same pattern as `useBirthYear`: localStorage + `useSyncExternalStore`, no prop-drilling.
- Prefs **encode into the share URL** (compact query param). A shared forecast carries the sender's lens — *"here's Lisbon through MY ideal conditions"* — which is a genuine viral loop, and costs the server nothing (recipient re-scores locally).
- Default prefs serialize to nothing (clean URLs); only deviations appear.

## Performance budget

- Re-score: 16 years × ~6 components ≈ 100 float ops. `useMemo` keyed on `(trajectory, prefs)`. Imperceptible.
- No refetch on knob change. Only score-derived components re-render.
- Slider drag is cheap enough to update live; no debounce needed (add `useDeferredValue` only if profiling ever shows jank).
- The drawer is lazy — sliders mount only when opened, so the default path carries zero extra weight.

## Files

| Path | Role |
|---|---|
| `client/src/lib/habitability.ts` | Pure TS port of the scorer + `Prefs` + parity self-check |
| `client/src/lib/use-prefs.ts` | Shared prefs store (localStorage + URL codec) |
| `client/src/components/your-conditions-drawer.tsx` | The slide-out knobs panel |
| re-score wiring | `use-climate-app` exposes a prefs-scored trajectory via `useMemo` |

## Out of scope (v1)

Server-side per-user scoring (unnecessary — client wins), persisting prefs to an account (no accounts), and changing the canonical rankings (forbidden by the honesty rule).
