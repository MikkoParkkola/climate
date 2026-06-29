// ── Plain-language glossary ───────────────────────────────────────────────────
// Every specialist term in the UI routes through <Term k="..."> and pulls its
// definition from here. Written for a 15–18-year-old: no jargon inside the
// definitions, real numbers, one concrete consequence. This is also the
// structural fix for caveat-fatigue — definitions live in tooltips, so body
// copy stays clean instead of carrying inline disclaimers.

export interface GlossaryEntry {
  label: string; // display name
  definition: string; // plain-language, ~one or two sentences
}

export const GLOSSARY = {
  heat_stress_day: {
    label: "Heat-stress day",
    definition:
      "A day hot enough that being outside for long gets risky — roughly above 32°C (90°F). More of them means worse sleep, harder outdoor work, and higher cooling bills.",
  },
  tropical_night: {
    label: "Tropical night",
    definition:
      "A night that stays above 20°C (68°F), so your body can't cool down while you sleep. A run of them is what makes heatwaves dangerous.",
  },
  drought_risk: {
    label: "Drought risk",
    definition:
      "How likely long dry spells are, on a 0–100 scale. Higher means more strain on water supplies, farming, and gardens.",
  },
  flood_risk: {
    label: "Heavy-rain & flood risk",
    definition:
      "How likely intense downpours and flooding are, on a 0–100 scale. Higher means more risk of flash floods and water damage.",
  },
  sea_level_rise: {
    label: "Sea-level rise",
    definition:
      "How much higher the ocean is expected to sit, in centimeters. It only matters if you're near the coast — far inland it's just background context.",
  },
  wet_bulb: {
    label: "Wet-bulb temperature",
    definition:
      "Heat and humidity combined. Above about 35°C wet-bulb the human body can't cool itself even in the shade — it's the real danger line for heat.",
  },
  habitability_score: {
    label: "Habitability score",
    definition:
      "Our 0–100 summary of how comfortable and safe a place is to live, blending heat, water and other hazards. Higher is better.",
  },
  emissions_scenario: {
    label: "Emissions scenario",
    definition:
      "A 'what if' path for how much greenhouse gas the world keeps emitting. Lower-emission paths mean less warming; higher paths mean more.",
  },
  current_policy: {
    label: "Current-policy path",
    definition:
      "What's projected if the world roughly keeps the climate policies it has today — not the best case, not the worst.",
  },
  cmip6: {
    label: "CMIP6",
    definition:
      "The big international set of climate-model runs that scientists and the UN's climate report rely on. Our numbers come from it, not from guesses.",
  },
  ipcc: {
    label: "IPCC AR6",
    definition:
      "The United Nations' latest major climate-science report (2021–2023). We line our numbers up with it.",
  },
  baseline: {
    label: "Baseline",
    definition: "The recent-past starting point we compare the future against (around 2025).",
  },
  anomaly: {
    label: "Change from baseline",
    definition:
      "How much something shifts from the starting point — '+2°C' means two degrees warmer than today, not two degrees in total.",
  },
  climate_twin: {
    label: "Climate twin",
    definition:
      "A place that today already feels like your location is projected to feel in the future — a way to picture the change.",
  },
  confidence: {
    label: "Confidence",
    definition: "How sure the projection is, based on how much the different climate models agree.",
  },
  crossover: {
    label: "Comfortable-band crossover",
    definition:
      "The year a place is projected to drop out of the comfortable range on this scenario. It's an approximate year, not an exact date.",
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
