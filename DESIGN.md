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

- **Display** `Fraunces` (serif): headlines, the location name, the verdict sentence. Weight 500–600. This carries the "field report" gravitas.
- **Mono** `Space Mono`: all data, axes, labels, the chip, receipts. Numbers are mono, always.
- **Body** `Public Sans` (bundled in `fonts.css`), system fallback: running prose. Deliberately **not Inter**. Inter is the default face every AI-generated UI reaches for, so it reads as generic; Public Sans is the considered pick. Any literal `font-family: 'Inter'` or hard-coded `fontFamily: "Inter…"` is a bug — Inter is not bundled, so it silently falls back to system and quietly breaks the type system. Always go through `--font-body`, never a literal family.
- **Floor: 12px.** Nothing below 12px for anything a user must read. Receipts are a trust differentiator — they were 9–10px and unreadable; that's a bug, not a style.
- **Radius: 4px (`--radius: 0.25rem`), and it stays tight.** Sharp corners are a choice: `rounded-2xl`/`3xl` on everything is the generator's tell. Cards, chips, inputs, buttons hold the token; only true pills (avatars, toggle knobs) go full-round. A `rounded-xl` card is drift — pull it back to the token.
- **Two things both called "accent".** The product `ACCENT` (ember, `hsl(24,88%,56%)`) is the signature. The shadcn `--accent` (`hsl(220,11%,18%)`) is only a neutral hover surface. They are not the same token; never wire a CTA to shadcn `--accent`.

## 3. The signature: the Livability Runway

`client/src/components/livability-runway.tsx`. The one screenshot. It must always carry, in this order:

1. **Location name** (Fraunces) + a **`limited-by` chip** (mono, ember) naming the dominant hazard.
2. **The verdict**: one committed Fraunces sentence. Takes a side. One driver dominates. Never a balanced list. (Built by `buildVerdict` in `client/src/lib/climate-verdict.ts`.)
3. **The personal line**: only if the user gave an age; framed against their own lifetime.
4. **The gauge**: a now→2100 bar whose gradient *is* the habitability score sampled over time (green→amber→red). The color is the data, not decoration. Crossover tick + lifetime diamond sit on it.
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

This is human-read product copy, so our writing style guidelines for human-read copy govern it. Take a position, show one concrete number, let one point dominate, no uniform rhythm, no "…, not Y" disclaimer mold. The verdict generator already bakes this in; keep hand-written copy to the same bar.

## 8. Motion

Motion is for meaning, not flourish. The one ambient move is the ember bloom's slow breathing, the "instrument is on" signal. Everything else is functional: a disclosure opening, a value crossfading when the scenario changes, a hover lift of 1px. `framer-motion` is available; reach for it rarely. Every animation honours `prefers-reduced-motion` and drops to an instant state change. If a motion is decorative and cutting it loses no meaning, cut it. Scattered animation is itself an AI-generated tell.

## 9. Maps (Leaflet)

The map is not the hero. The genre is drowning in choropleth basemaps, and a tile-heavy map is the wrong load on minimal hosting. Use it only where it carries a story the numbers can't.

- **Basemap: dark and quiet.** A muted graphite basemap that recedes, never the default bright OSM tiles that fight the instrument and shout "leaflet demo". Labels low-contrast.
- **The signature is the climate-twin arc**, not a data overlay: the searched location to its present-day analog, one ember arc, marker weight carrying match quality. A static projection is enough; a slippy tiled map is overkill.
- **Hazard overlays use the runway zones** (green, amber, red), never a rainbow ramp. Semantic colour only.
- **Honesty holds on the map too**: a location with no real analog shows no arc and says so, exactly as the runway does.

## 10. The share / OG card

The card is the product's most-seen surface. It travels where the app doesn't. Generated by `satori`/`resvg`. It is the Livability Runway distilled: location in Fraunces, the verdict sentence, the ember gauge, one `limited-by` chip. 1200×630, graphite ground, one ember accent. No feature list, no logo wall. If a stranger sees only the card, the verdict must land. The card must render even on a cold container, gated behind the same reliability the site needs, because an unfurl bot that hits a dead host produces no card at all.

## 11. Charts (Chart.js / Recharts)

- **Scenario colours are the SSOT** (`SCENARIO_LINE_COLORS` in `climate-constants.ts`). Never re-pick per chart; a scenario is one colour everywhere, else the reader loses the thread.
- **Axes and numbers are mono** (`Space Mono`), tick labels quiet, grid faint if present. The data is the ink.
- **Emphasise the endpoint**, not the whole line: a dot at 2100, the value called out. An area fill only where it encodes magnitude, never for decoration.
- **The gauge's gradient is the data** (habitability sampled over time), stated in §3. That principle generalises: colour encodes a value, else it does not appear.

## 12. Empty, loading, and no-data states

Honesty (§4) extends past the happy path. A place with missing model data shows the gap plainly and names the absent field; it never interpolates a plausible-looking number to fill a card. Loading is the runway skeleton, not a spinner in the void. An error names what failed and what the reader can do, in the product's voice, no apology-and-vagueness. A blank state that lies about coverage is the same failure as a fabricated coefficient.

## 13. Theme: one deliberate dark instrument

fupit is dark-only, on purpose. The instrument reads as an instrument. `:root` already carries the dark values; the duplicate `.dark` block is redundant shadcn scaffolding and can go. Do not add a light theme without a real reason; a half-built light mode is worse than a committed dark one.

## 14. Anti-AI-tell guardrails (enforced, not aspirational)

The look above is the opposite of the generated-UI default, and that is the point. A climate tool that reads as machine-made undercuts its own claim to trustworthy data. These are hard rules, checked by `~/.claude/skills/anti-ai-tell/visual_lint.py` before shipping UI:

- **No glassmorphism.** Panels are opaque. The `.glass-card` `backdrop-filter: blur()` is banned; the token comment already says "no glassmorphism", so the class must match the words.
- **Restrained glow.** The ember bloom is one subtle radial per card, per §3. Stacked `shadow-2xl` and neon glows are the demo look; a result view carrying a dozen heavy shadows is drift.
- **No gradient-clipped text.** Headlines are a solid colour, never `bg-clip-text` rainbow.
- **No violet-to-blue.** Purple, indigo, fuchsia is the AI-SaaS palette fingerprint; it has leaked into at least one explainer and must come out. Blue survives only inside data series where a variable genuinely reads as water/cold (§1).
- **Real icons, never emoji** as section markers.

Repo prose a stranger reads (README, issue and PR bodies, product copy) runs through `~/.claude/skills/anti-ai-tell/lint.py`, for the same reason: the writing must not broadcast its origin either.

---

*Living doc. Update it in the same change that alters the look. A style guide that lies is worse than none.*
