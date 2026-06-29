# fupit — Design Language: **Ember Instrument**

The look: a scientific instrument you'd trust, with one warm signature that makes it screenshot-worthy. **Cool graphite base, ember accent, one signature visualization.** Not a generic dashboard, not a brown field-journal either — a cool dark instrument with a single ember running through it: the warming line, the CTA, the live glow.

Tokens are the single source of truth in `client/src/lib/climate-constants.ts`. This doc explains *how to use them*, not a second copy of the values.

---

## 1. Palette (graphite + ember)

| Token | Value | Use |
|---|---|---|
| `BG` | `hsl(222,16%,8%)` | page background (cool near-black graphite, never brown) |
| `CARD` | `hsl(222,15%,12%)` | panels, the runway card |
| `BORDER` | `hsl(220,13%,22%)` | hairlines, 1px only |
| `ACCENT` | `hsl(24,88%,56%)` | the ember. CTAs, the glow, active state, term underlines |
| `MUTED` | `hsl(220,9%,63%)` | secondary text, captions, receipts (cool gray) |
| `GREEN / AMBER / RED` | see tokens | the runway zones: livable → stressed → danger |

**Two hard rules.** (1) **No brown.** The base is cool graphite (hue ~220, low saturation); warm low-saturation darks read as brown and are banned from chrome. (2) **Ember owns the accent.** CTAs, active states and the glow are `ACCENT` ember — never blue. The old blue CTA gradient (`hsl(192…215)`) is gone. Vivid blues survive *only* inside data series where a variable genuinely reads as water/cold; never in buttons, accents, or the favicon.

## 2. Type

- **Display** `Fraunces` (serif) — headlines, the location name, the verdict sentence. Weight 500–600. This carries the "field report" gravitas.
- **Mono** `Space Mono` — all data, axes, labels, the chip, receipts. Numbers are mono, always.
- **Body** Inter/system — running prose.
- **Floor: 12px.** Nothing below 12px for anything a user must read. Receipts are a trust differentiator — they were 9–10px and unreadable; that's a bug, not a style.

## 3. The signature: the Livability Runway

`client/src/components/livability-runway.tsx`. The one screenshot. It must always carry, in this order:

1. **Location name** (Fraunces) + a **`limited-by` chip** (mono, ember) naming the dominant hazard.
2. **The verdict** — one committed Fraunces sentence. Takes a side. One driver dominates. Never a balanced list. (Built by `buildVerdict` in `client/src/lib/climate-verdict.ts`.)
3. **The personal line** — only if the user gave an age; framed against their own lifetime.
4. **The gauge** — a now→2100 bar whose gradient *is* the habitability score sampled over time (green→amber→red). The color is the data, not decoration. Crossover tick + lifetime diamond sit on it.
5. **Reason codes** — ≤3 ranked drivers, each: term (with tooltip), a 0–10 ember severity bar, a direction arrow, one plain sentence. Plus the single *relief* line ("not your problem here") for the hazard that doesn't apply — signal, not boilerplate.

The ember bloom (top-right radial, `ACCENT` at ~13% alpha) is the "instrument is on" glow. Subtle. One per card.

## 4. Honesty in the visuals (THE CARDINAL RULE)

- The crossover year is shown as a **band** (`~2065`), never a false-precise point, and always labeled scenario-conditional ("on this scenario").
- If a place never leaves the livable band in-data, say so — never extrapolate past 2100.
- Every derived number traces to a model field. No invented coefficients in copy or chart.

## 5. Jargon → tooltips, never inline disclaimers

`<Term k="…">` (`client/src/components/climate-term.tsx`) wraps any specialist word: dotted ember underline, hover/tap reveals a plain-language definition from `client/src/lib/glossary.ts`. Definitions are written for a 15–18-year-old: no jargon inside them, a real number, one concrete consequence.

This is also the structural cure for caveat-fatigue: the page used to carry 30+ inline disclaimers (the "…, not Y" reflex that reads as machine-written). Move the explanation into the tooltip; keep the body sentence clean and committed.

## 6. Knobs stay out of the way

Main view = **location + optional age + Go.** Everything else (scenario, future personal comfort band) lives behind a disclosure or drawer with sensible defaults. Default scenario is the current-policy path. 95% of users should never open the options.

## 7. Voice (external copy)

This is human-read product copy → the `anti-ai-tell` skill governs it, not internal ELITE voice. Take a position, show one concrete number, let one point dominate, no uniform rhythm, no "…, not Y" disclaimer mold. The verdict generator already bakes this in; keep hand-written copy to the same bar.

---

*Living doc. Update it in the same change that alters the look. A style guide that lies is worse than none.*
