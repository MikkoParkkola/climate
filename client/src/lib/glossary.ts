// ── Plain-language glossary ───────────────────────────────────────────────────
// Every specialist term in the UI routes through <Term k="..."> and pulls its
// definition from here. Written for a 15–18-year-old: no jargon inside the
// definitions, real numbers, one concrete consequence. This is also the
// structural fix for caveat-fatigue — definitions live in tooltips, so body
// copy stays clean instead of carrying inline disclaimers.
//
// VALUE-AWARE TOOLTIPS: a number on its own ("2376 heating °C·days/yr") means
// nothing to a teenager. Where a metric has an `interpret(value)`, the tooltip
// adds a third line that says whether THIS number is high/low/typical and what
// it means for the person. Bands are either documented thresholds already used
// elsewhere in the app, or a plain qualitative low/moderate/high/extreme scale —
// never an invented "official" cutoff presented as authoritative.

export interface GlossaryEntry {
  label: string; // display name
  definition: string; // plain-language, ~one or two sentences (explains the TERM and its UNIT)
  // Optional value-aware line. Given the raw number shown on the card, return a
  // short plain-language read: is it high or low, and what does that mean here?
  interpret?: (value: number) => string;
}

export const GLOSSARY = {
  heat_stress_day: {
    label: "Heat-stress day",
    definition:
      "A day hot enough that being outside for long gets risky — roughly above 32°C (90°F). More of them means worse sleep, harder outdoor work, and higher cooling bills.",
    interpret: (v) =>
      v <= 0
        ? "Zero — this place basically never gets dangerously hot."
        : v < 20
          ? `${Math.round(v)} a year is low — only the odd hot stretch.`
          : v < 100
            ? `${Math.round(v)} a year is a real summer-heat load — plan around it.`
            : `${Math.round(v)} a year is a lot — heat is a daily fact of life here.`,
  },
  tropical_night: {
    label: "Tropical night",
    definition:
      "A night that stays above 20°C (68°F), so your body can't cool down while you sleep. A run of them is what makes heatwaves dangerous.",
    interpret: (v) =>
      v <= 0
        ? "None — nights here cool off enough to sleep comfortably."
        : v < 30
          ? `${Math.round(v)} a year is modest — mostly fine, hot spells aside.`
          : `${Math.round(v)} a year is high — sleep and recovery suffer in summer.`,
  },
  drought_risk: {
    label: "Drought risk",
    definition:
      "How likely long dry spells are, on a 0–100 scale built from the longest run of days with almost no rain. Higher means more strain on water supplies, farming, and gardens.",
    // Bands match the result-card wording: <25 Low, <40 Elevated, else High.
    interpret: (v) =>
      v < 25
        ? `${Math.round(v)}/100 is low — dry spells are short here.`
        : v < 40
          ? `${Math.round(v)}/100 is elevated — expect longer dry stretches.`
          : `${Math.round(v)}/100 is high — long droughts are a serious risk.`,
  },
  flood_risk: {
    label: "Heavy-rain & flood risk",
    definition:
      "How likely intense downpours are, on a 0–100 scale built from the wettest 5-day rain total. Higher means more risk of flash floods and water damage.",
    // Bands match the result-card wording: <30 Low, <60 Elevated, else High.
    interpret: (v) =>
      v < 30
        ? `${Math.round(v)}/100 is low — heavy-rain flooding is unlikely.`
        : v < 60
          ? `${Math.round(v)}/100 is elevated — big downpours happen.`
          : `${Math.round(v)}/100 is high — intense rain and flash floods are a real risk.`,
  },
  sea_level_rise: {
    label: "Sea-level rise",
    definition:
      "How much higher the ocean is expected to sit, in centimeters, compared to today. It only matters if you're near the coast — far inland it's just background context.",
    interpret: (v) =>
      v <= 0
        ? "Not applicable here (inland or no coastal data)."
        : v < 20
          ? `${Math.round(v)} cm is modest, but it raises the floor that storms surge on top of.`
          : v < 50
            ? `${Math.round(v)} cm is significant for low-lying coasts — more flooding and erosion.`
            : `${Math.round(v)} cm is large — serious trouble for low coastal areas.`,
  },
  dynamic_sea_level: {
    label: "Dynamic sea level",
    definition:
      "The ocean doesn't rise evenly everywhere — winds, currents, and gravity make some coasts rise faster than the global average. That regional difference is the 'dynamic' part.",
  },
  wet_bulb: {
    label: "Wet-bulb temperature",
    definition:
      "Heat and humidity combined into one number. Sweat only cools you if it can evaporate, and in humid heat it can't. Above about 35°C wet-bulb the human body can't cool itself even in the shade — the real danger line.",
    interpret: (v) =>
      v < 24
        ? `${v.toFixed(1)}°C wet-bulb is comfortable — humidity isn't dangerous here.`
        : v < 28
          ? `${v.toFixed(1)}°C wet-bulb is getting muggy — heavy activity feels rough.`
          : v < 31
            ? `${v.toFixed(1)}°C wet-bulb is dangerous for outdoor work and the vulnerable.`
            : `${v.toFixed(1)}°C wet-bulb is extreme — close to the limit the body can survive.`,
  },
  wbgt: {
    label: "WBGT",
    definition:
      "Wet-Bulb Globe Temperature: a heat-stress index used by sports and the military that mixes humidity, sun, and wind. fupit shows a humidity-only screen, not full WBGT, because we don't have the sun and wind inputs.",
  },
  humid_heat_days: {
    label: "Humid-heat days",
    definition:
      "Days per year when the combined heat-and-humidity (wet-bulb) climbs above 28°C — the point where your body struggles to cool down. More of them means more dangerous, draining heat.",
    // Bands match the result-card colours: >30 severe (red), >5 notable (orange).
    interpret: (v) =>
      v <= 0
        ? "None — humid heat isn't a danger here."
        : v <= 5
          ? `${Math.round(v)} a year is low — only the occasional sticky-dangerous day.`
          : v <= 30
            ? `${Math.round(v)} a year is notable — real humid-heat risk in summer.`
            : `${Math.round(v)} a year is severe — humid heat is a major, recurring danger.`,
  },
  degree_days: {
    label: "Degree-days",
    definition:
      "A way to measure how much heating or cooling a place needs over a year. Each day is counted by how far the temperature sits from a comfortable 18°C, then all days are added up. Bigger number = more energy needed.",
  },
  degree_day_unit: {
    label: "°C·days per year",
    definition:
      "The unit for degree-days. One '°C·day' is one degree away from comfortable, for one day. Add up every day's gap over a year and you get this total — a rough size of the yearly heating or cooling job.",
  },
  cooling_degree_days: {
    label: "Cooling degree-days",
    definition:
      "How much air-conditioning a place needs over a year, in °C·days. It adds up how far above a comfortable 18°C each day gets. A big number means a hot place where cooling matters; near zero means it rarely gets hot enough to need AC.",
    // Qualitative bands for base-18°C CDD (tropical >2000, temperate few hundred).
    interpret: (v) =>
      v < 50
        ? `${Math.round(v)} is very low — this place rarely gets hot enough to need cooling (for now).`
        : v < 300
          ? `${Math.round(v)} is low — a bit of cooling in summer, nothing major.`
          : v < 800
            ? `${Math.round(v)} is moderate — real summer cooling demand.`
            : v < 2000
              ? `${Math.round(v)} is high — a hot place where cooling runs much of the year.`
              : `${Math.round(v)} is very high — tropical-hot, cooling almost year-round.`,
  },
  heating_degree_days: {
    label: "Heating degree-days",
    definition:
      "How much heating a place needs over a year, in °C·days. It adds up how far below a comfortable 18°C each day falls. A big number means a cold, heating-heavy place; near zero means it rarely gets cold enough to heat.",
    // Qualitative bands for base-18°C HDD (subarctic >5000, N Europe ~2500-3500).
    interpret: (v) =>
      v < 500
        ? `${Math.round(v)} is very low — a warm place that barely needs heating.`
        : v < 1500
          ? `${Math.round(v)} is low-to-moderate — mild winters, some heating.`
          : v < 3000
            ? `${Math.round(v)} is a cool, heating-heavy climate, typical of northern Europe. It drops as the world warms.`
            : v < 5000
              ? `${Math.round(v)} is high — long, cold winters with heavy heating needs.`
              : `${Math.round(v)} is very high — severe cold, heating almost all year.`,
  },
  water_stress: {
    label: "Water stress",
    definition:
      "How much of a region's available freshwater is already being used up each year. 'High' means demand from homes, farms, and industry is close to the supply, so shortages and rationing are more likely.",
    // value = Aqueduct category: -1 arid, 0 low, 1 low-med, 2 med-high, 3 high, 4 extreme.
    interpret: (v) =>
      v === -1
        ? "Arid with low water use — very little water, but little demand too."
        : v <= 0
          ? "Low — plenty of water for demand here."
          : v === 1
            ? "Low-to-medium — usually enough, but tighter in dry years."
            : v === 2
              ? "Medium-to-high — competition for water is real."
              : v === 3
                ? "High — demand is close to supply; shortages are likely."
                : "Extremely high — almost all available water is already used.",
  },
  fire_weather: {
    label: "Fire weather",
    definition:
      "Weather that makes wildfires easy to start and spread — hot, dry, windy days with thirsty plants. It's about the conditions, not whether a fire actually starts.",
  },
  extreme_fire_days: {
    label: "Extreme fire-weather days",
    definition:
      "Days per year with weather so hot and dry that fires could spread fast (high Fire Weather Index). More of them means a longer, more dangerous fire season — but it doesn't predict a specific fire at your address.",
    interpret: (v) =>
      v <= 0
        ? "None — fire-prone weather is basically absent here."
        : v <= 7
          ? `${Math.round(v)} a year is low — only the occasional risky day.`
          : v <= 30
            ? `${Math.round(v)} a year is moderate — a real fire season to plan around.`
            : v <= 90
              ? `${Math.round(v)} a year is high — long, dangerous fire seasons.`
              : `${Math.round(v)} a year is extreme — fire-prone weather much of the year.`,
  },
  fwi: {
    label: "Fire Weather Index (FWI)",
    definition:
      "A standard score (used by fire services worldwide) for how dangerous the day's weather is for wildfires. It blends temperature, humidity, wind, and how dry the plants are.",
  },
  river_flood: {
    label: "River-flood exposure",
    definition:
      "The share of the nearby area that sits in the path of a once-in-100-years river flood. Higher means more of the surrounding land could go underwater in a rare big flood — a regional screen, not a check of your exact street.",
    interpret: (v) =>
      v < 1
        ? `${v < 0.1 ? v.toFixed(1) : v.toFixed(0)}% is very low — little modeled river-flood exposure nearby.`
        : v < 5
          ? `${v.toFixed(0)}% is low-to-moderate — some land near rivers could flood.`
          : v < 20
            ? `${v.toFixed(0)}% is significant — a meaningful slice of the area floods in a big event.`
            : `${v.toFixed(0)}% is high — much of the surrounding area sits in the flood zone.`,
  },
  frost_days: {
    label: "Frost days",
    definition:
      "Days per year when the temperature drops below 0°C (freezing) overnight. Fewer of them as the world warms means shorter winters, but also fewer hard frosts that some crops and ecosystems rely on.",
    // Bands match the result-card colours: >60 long winter (cyan), >5 regular (blue).
    interpret: (v) =>
      v <= 0
        ? "None — it basically never freezes here."
        : v <= 5
          ? `${Math.round(v)} a year is occasional — only the odd frosty night.`
          : v <= 60
            ? `${Math.round(v)} a year is a normal cold-season frost count.`
            : `${Math.round(v)} a year means a long, hard winter.`,
  },
  ice_days: {
    label: "Ice days",
    definition:
      "Days per year that stay below 0°C all day, not just overnight — the daytime high never gets above freezing. A marker of deep winter cold.",
  },
  cold_spell: {
    label: "Cold spell",
    definition:
      "A run of several days in a row of unusually cold weather. Hard on heating, roads, and people without warm housing.",
  },
  cold_season: {
    label: "Cold-season context",
    definition:
      "A summary of winter cold: how many freezing nights and all-day-freezing days there are, and how cold the coldest night gets. It shows whether a place still has a real winter as the climate warms.",
  },
  crop_yield: {
    label: "Crop-yield change",
    definition:
      "The modeled change in how much a staple crop (like wheat or maize) would grow here, compared to recent decades. A minus means smaller harvests; a plus means bigger ones. It's a regional signal, not a single farm's forecast.",
    interpret: (v) =>
      v <= -10
        ? `${v.toFixed(0)}% is a big drop — harvests here take a serious hit.`
        : v < -2
          ? `${v.toFixed(0)}% means smaller harvests than today.`
          : v <= 2
            ? `${v >= 0 ? "+" : ""}${v.toFixed(0)}% is roughly flat — little change either way.`
            : v < 10
              ? `+${v.toFixed(0)}% means somewhat bigger harvests.`
              : `+${v.toFixed(0)}% is a large gain — much better growing conditions.`,
  },
  habitability_score: {
    label: "Habitability score",
    definition:
      "Our 0–100 summary of how comfortable and safe a place is to live, blending temperature comfort, water, and hazards like heat and flooding. Higher is better.",
    // Bands match the result-card legend: 0-39 Severe, 40-59 Poor, 60-69 Fair, 70-84 Good, 85-100 Excellent.
    interpret: (v) =>
      v < 40
        ? `${Math.round(v)}/100 is severe — tough conditions to live in.`
        : v < 60
          ? `${Math.round(v)}/100 is poor — livable but with real strain.`
          : v < 70
            ? `${Math.round(v)}/100 is fair — okay, with some hazards.`
            : v < 85
              ? `${Math.round(v)}/100 is good — comfortable and fairly safe.`
              : `${Math.round(v)}/100 is excellent — among the most comfortable places.`,
  },
  emissions_scenario: {
    label: "Emissions scenario",
    definition:
      "A 'what if' path for how much greenhouse gas the world keeps emitting. Lower-emission paths mean less warming; higher paths mean more. We show four, named SSP1-2.6 up to SSP5-8.5.",
  },
  ssp126: {
    label: "SSP1-2.6",
    definition:
      "The optimistic low-emissions path: the world cuts hard and fast. Warming lands around 1.8°C above pre-industrial by 2100 — better than today's policies are on track for.",
  },
  ssp245: {
    label: "SSP2-4.5",
    definition:
      "The middle path, closest to what current policies actually deliver. Warming lands around 2.7°C by 2100. fupit uses this as the default view.",
  },
  ssp370: {
    label: "SSP3-7.0",
    definition:
      "A high-emissions path where progress stalls or reverses. Warming lands around 3.6°C by 2100 — a real risk, not the central expectation.",
  },
  ssp585: {
    label: "SSP5-8.5",
    definition:
      "The very-high-emissions worst case, now considered unlikely. Warming lands around 4.4°C by 2100. We keep it as a stress test, not 'business as usual.'",
  },
  current_policy: {
    label: "Current-policy path",
    definition:
      "What's projected if the world roughly keeps the climate policies it has today — not the best case, not the worst. Right now that points to about 2.6–2.8°C of warming by 2100.",
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
  ensemble: {
    label: "Model ensemble",
    definition:
      "Many different climate models run the same scenario and we average their answers. Using a crowd of models instead of one is more reliable than trusting any single model.",
  },
  model_spread: {
    label: "Model spread",
    definition:
      "How much the different climate models disagree about a number. A small spread means the models agree (more confidence); a wide spread means more uncertainty.",
  },
  percentile: {
    label: "Percentile",
    definition:
      "A way of ranking a value against all the others. The 90th percentile means only 10% of cases are higher — useful for spotting the extreme, rare events.",
  },
  resolution: {
    label: "Resolution (~25 km)",
    definition:
      "How fine-grained the map is. '~25 km' means each data point covers about a 25 km square, so the number describes your wider area, not your exact street.",
  },
  baseline: {
    label: "Baseline",
    definition: "The recent-past starting point we compare the future against (around 2025).",
  },
  anomaly: {
    label: "Change from baseline",
    definition:
      "How much something shifts from the starting point — '+2°C' means two degrees warmer than today, not two degrees in total.",
    interpret: (v) =>
      v <= 0
        ? `${v.toFixed(1)}°C — no warming or slight cooling versus today.`
        : v < 1.5
          ? `+${v.toFixed(1)}°C is moderate warming versus today.`
          : v < 3
            ? `+${v.toFixed(1)}°C is large — clearly hotter than today.`
            : `+${v.toFixed(1)}°C is huge — a transformed local climate.`,
  },
  climate_sensitivity: {
    label: "Climate sensitivity",
    definition:
      "How much the planet warms if the amount of CO₂ in the air doubles. A higher number means the climate reacts more strongly to the same emissions.",
  },
  circulation: {
    label: "Circulation pattern",
    definition:
      "The large-scale winds and pressure systems that shape a region's weather — like the trade winds or the jet stream.",
  },
  amoc: {
    label: "AMOC (the Atlantic's heat conveyor)",
    definition:
      "The ocean current that carries warm water north and keeps north-west Europe mild — the system the Gulf Stream is part of. If it weakens or collapses, Europe could cool even as the rest of the planet warms.",
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
  tipping_point: {
    label: "Tipping point",
    definition:
      "A threshold where a part of the climate flips into a new state that's hard to reverse — like an ice sheet starting an unstoppable melt. Crossing one can lock in big, long-lasting change.",
  },
  crossover: {
    label: "Comfortable-band crossover",
    definition:
      "The year a place is projected to drop out of the comfortable range on this scenario. It's an approximate year, not an exact date.",
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
