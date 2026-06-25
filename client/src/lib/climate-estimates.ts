// ─────────────────────────────────────────────────────────────────────────────
// Derived climate-impact estimates
//
// The atmospheric model returns temperature, precipitation, extreme-risk and
// habitability data directly. The four panels below are NOT direct model
// outputs — they are transparent, reproducible estimates derived from the real
// modeled variables plus published scientific relationships and (for air
// quality) a free public dataset. Every value is clearly labelled as an
// estimate in the UI.
//
// Sources / methodology:
//  • Agricultural viability — agro-climatic suitability in the spirit of the
//    FAO Global Agro-Ecological Zones (GAEZ) framework: thermal suitability +
//    water adequacy, penalised by heat stress and drought.
//  • Biodiversity loss — aggregate share of species losing the majority of
//    their climatic range, calibrated to IPCC AR6 / Warren et al. 2018 (Science)
//    warming → range-loss figures (~6% @ +1.5°C, ~14% @ +2°C, ~40% @ +3.2°C).
//  • Water stress — demand/availability proxy from modeled drought risk and
//    precipitation deficit.
//  • Air quality — present-day measured AQI (Open-Meteo Air Quality API, free,
//    no key) plus the well-documented "climate penalty" on ground-level ozone
//    (ozone rises with temperature and stagnation/heat episodes).
//  • Climate twin — nearest present-day climate analog, matched on annual mean
//    temperature and annual precipitation against a reference set of global city
//    climate normals (climate-analog method, cf. Bastin et al. 2019).
// ─────────────────────────────────────────────────────────────────────────────

export interface EstimateInputs {
  avgTemp: number;        // °C, projected annual mean
  tempAnomaly: number;    // °C of warming vs baseline
  annualPrecip: number;   // mm/yr, projected
  precipChangePct: number; // % change vs baseline
  heatDays: number;       // projected heat-stress days/yr
  baseHeatDays: number;   // baseline (2025) heat-stress days/yr
  droughtRisk: number;    // 0–1, projected
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Warming already observed by ~2025 relative to the 1850–1900 pre-industrial
// baseline (IPCC AR6: ~1.2–1.3°C). The model's anomalies are relative to the
// recent (≈2025) climate, so this offset converts them to total warming for the
// biodiversity curve, whose anchor points are defined vs. pre-industrial.
const CURRENT_WARMING_C = 1.3;

/**
 * Agricultural viability index (0–100). A composite agro-climatic suitability
 * score: thermal suitability and water adequacy, penalised by heat stress and
 * drought. Warming can raise viability in cold regions and lower it in already
 * warm/dry regions — both emerge naturally from the formula.
 */
export function agriculturalViability(i: EstimateInputs): number {
  // Thermal suitability: broad optimum ~10–22°C annual mean for staple crops.
  let thermal: number;
  if (i.avgTemp >= 10 && i.avgTemp <= 22) thermal = 100;
  else if (i.avgTemp < 10) thermal = clamp(100 - (10 - i.avgTemp) * 6, 0, 100); // cold limit
  else thermal = clamp(100 - (i.avgTemp - 22) * 7, 0, 100);                     // heat limit

  // Water adequacy: optimum ~600–1300 mm; arid and waterlogged both penalised.
  let water: number;
  if (i.annualPrecip >= 600 && i.annualPrecip <= 1300) water = 100;
  else if (i.annualPrecip < 600) water = clamp((i.annualPrecip / 600) * 100, 0, 100);
  else water = clamp(100 - (i.annualPrecip - 1300) / 25, 0, 100);

  const base = 0.5 * thermal + 0.5 * water;
  const heatPenalty = clamp(i.heatDays * 0.8, 0, 40);
  const droughtPenalty = i.droughtRisk * 30;
  return Math.round(clamp(base - heatPenalty - droughtPenalty, 0, 100));
}

/**
 * Biodiversity loss (% of species losing the majority of their climatic range).
 * Piecewise-linear interpolation through published warming → range-loss anchor
 * points (IPCC AR6 / Warren et al. 2018), evaluated at total warming since
 * pre-industrial and lightly modulated by precipitation disruption. Bounded so
 * it cannot run away beyond the calibrated range.
 */
export function biodiversityLoss(i: EstimateInputs): number {
  const x = Math.max(0, i.tempAnomaly) + CURRENT_WARMING_C; // total °C vs pre-industrial
  // [warming °C, % species losing >half their climatic range]
  const anchors: [number, number][] = [
    [0, 0], [1.0, 2], [1.5, 6], [2.0, 14], [3.2, 40], [4.5, 55], [6.0, 65],
  ];
  let base = anchors[anchors.length - 1][1];
  for (let k = 1; k < anchors.length; k++) {
    if (x <= anchors[k][0]) {
      const [x0, y0] = anchors[k - 1];
      const [x1, y1] = anchors[k];
      base = y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
      break;
    }
  }
  const precipFactor = 1 + clamp(Math.abs(i.precipChangePct) / 200, 0, 0.2);
  return Math.round(clamp(base * precipFactor, 0, 100));
}

/**
 * Water stress (0–100). Demand/availability proxy: modeled drought risk,
 * worsened when precipitation declines relative to baseline.
 */
export function waterStress(i: EstimateInputs): number {
  const droughtComponent = i.droughtRisk * 100;
  const precipDeficit = i.precipChangePct < 0 ? clamp(-i.precipChangePct * 0.6, 0, 25) : 0;
  return Math.round(clamp(droughtComponent * 0.8 + precipDeficit, 0, 100));
}

/**
 * Projected Air Quality Index. Starts from a present-day baseline AQI (measured,
 * when available) and adds the climate penalty on ozone: ground-level ozone
 * rises with temperature and with heat/stagnation episodes.
 */
export function projectedAqi(baselineAqi: number, i: EstimateInputs): number {
  const ozonePenalty = Math.max(0, i.tempAnomaly) * 4; // ~4 AQI pts per °C of warming
  const stagnationPenalty = Math.max(0, i.heatDays - i.baseHeatDays) * 0.3;
  return Math.round(clamp(baselineAqi + ozonePenalty + stagnationPenalty, 0, 300));
}

// Fallback present-day AQI when the live source is unavailable (typical
// urban "Moderate" baseline). Clearly labelled as estimated in the UI.
export const FALLBACK_BASELINE_AQI = 45;

// ── Climate-twin reference: global city climate normals ──────────────────────
// Approximate published annual mean temperature (°C) and annual precipitation
// (mm). Used only to find the nearest present-day analog for a projected climate.
interface CityNormal { name: string; temp: number; precip: number }

const CITY_NORMALS: CityNormal[] = [
  { name: "Reykjavík, Iceland", temp: 5.0, precip: 800 },
  { name: "Tromsø, Norway", temp: 3.0, precip: 1000 },
  { name: "Anchorage, USA", temp: 3.0, precip: 410 },
  { name: "Calgary, Canada", temp: 4.5, precip: 420 },
  { name: "Helsinki, Finland", temp: 6.0, precip: 650 },
  { name: "Oslo, Norway", temp: 6.0, precip: 760 },
  { name: "Moscow, Russia", temp: 6.0, precip: 700 },
  { name: "Stockholm, Sweden", temp: 7.0, precip: 540 },
  { name: "Warsaw, Poland", temp: 9.0, precip: 520 },
  { name: "Edinburgh, UK", temp: 9.0, precip: 700 },
  { name: "Copenhagen, Denmark", temp: 9.0, precip: 600 },
  { name: "Toronto, Canada", temp: 9.0, precip: 830 },
  { name: "Munich, Germany", temp: 9.0, precip: 950 },
  { name: "Zürich, Switzerland", temp: 9.5, precip: 1050 },
  { name: "Berlin, Germany", temp: 10.0, precip: 570 },
  { name: "Chicago, USA", temp: 10.0, precip: 940 },
  { name: "Amsterdam, Netherlands", temp: 10.5, precip: 800 },
  { name: "Denver, USA", temp: 10.5, precip: 350 },
  { name: "Brussels, Belgium", temp: 11.0, precip: 850 },
  { name: "Vienna, Austria", temp: 11.0, precip: 620 },
  { name: "Vancouver, Canada", temp: 11.0, precip: 1190 },
  { name: "London, UK", temp: 11.5, precip: 620 },
  { name: "Seattle, USA", temp: 11.5, precip: 950 },
  { name: "Paris, France", temp: 12.0, precip: 640 },
  { name: "Beijing, China", temp: 12.5, precip: 570 },
  { name: "Seoul, South Korea", temp: 12.5, precip: 1450 },
  { name: "New York, USA", temp: 13.0, precip: 1200 },
  { name: "Lyon, France", temp: 13.0, precip: 830 },
  { name: "Wellington, New Zealand", temp: 13.0, precip: 1200 },
  { name: "Milan, Italy", temp: 13.5, precip: 1000 },
  { name: "Bordeaux, France", temp: 14.0, precip: 950 },
  { name: "Bogotá, Colombia", temp: 14.0, precip: 800 },
  { name: "San Francisco, USA", temp: 14.5, precip: 600 },
  { name: "Istanbul, Turkey", temp: 14.5, precip: 840 },
  { name: "Santiago, Chile", temp: 14.5, precip: 350 },
  { name: "Madrid, Spain", temp: 15.0, precip: 420 },
  { name: "Melbourne, Australia", temp: 15.0, precip: 650 },
  { name: "Marseille, France", temp: 15.5, precip: 520 },
  { name: "Nice, France", temp: 15.5, precip: 770 },
  { name: "Auckland, New Zealand", temp: 15.5, precip: 1150 },
  { name: "Rome, Italy", temp: 16.0, precip: 800 },
  { name: "Naples, Italy", temp: 16.0, precip: 1000 },
  { name: "Tokyo, Japan", temp: 16.0, precip: 1530 },
  { name: "Addis Ababa, Ethiopia", temp: 16.0, precip: 1200 },
  { name: "Barcelona, Spain", temp: 16.5, precip: 640 },
  { name: "Mexico City, Mexico", temp: 16.5, precip: 850 },
  { name: "Lisbon, Portugal", temp: 17.0, precip: 720 },
  { name: "Atlanta, USA", temp: 17.0, precip: 1270 },
  { name: "Cape Town, South Africa", temp: 17.0, precip: 520 },
  { name: "Shanghai, China", temp: 17.0, precip: 1150 },
  { name: "Tehran, Iran", temp: 17.0, precip: 230 },
  { name: "Sydney, Australia", temp: 18.0, precip: 1200 },
  { name: "Buenos Aires, Argentina", temp: 18.0, precip: 1200 },
  { name: "Los Angeles, USA", temp: 18.0, precip: 380 },
  { name: "Casablanca, Morocco", temp: 18.0, precip: 430 },
  { name: "Nairobi, Kenya", temp: 18.0, precip: 870 },
  { name: "Athens, Greece", temp: 18.5, precip: 400 },
  { name: "Palermo, Italy", temp: 18.5, precip: 600 },
  { name: "Perth, Australia", temp: 18.5, precip: 730 },
  { name: "Sevilla, Spain", temp: 19.0, precip: 540 },
  { name: "Tel Aviv, Israel", temp: 20.0, precip: 530 },
  { name: "Las Vegas, USA", temp: 20.0, precip: 110 },
  { name: "Houston, USA", temp: 21.0, precip: 1260 },
  { name: "New Orleans, USA", temp: 21.0, precip: 1600 },
  { name: "Cairo, Egypt", temp: 22.0, precip: 25 },
  { name: "Rio de Janeiro, Brazil", temp: 24.0, precip: 1100 },
  { name: "Phoenix, USA", temp: 24.0, precip: 200 },
  { name: "Miami, USA", temp: 25.0, precip: 1570 },
  { name: "Delhi, India", temp: 25.0, precip: 790 },
  { name: "Dakar, Senegal", temp: 25.0, precip: 500 },
  { name: "Riyadh, Saudi Arabia", temp: 26.0, precip: 110 },
  { name: "Kuwait City, Kuwait", temp: 26.5, precip: 110 },
  { name: "Lagos, Nigeria", temp: 27.0, precip: 1500 },
  { name: "Jakarta, Indonesia", temp: 27.0, precip: 1800 },
  { name: "Mumbai, India", temp: 27.5, precip: 2200 },
  { name: "Singapore", temp: 27.5, precip: 2340 },
  { name: "Manila, Philippines", temp: 28.0, precip: 2000 },
  { name: "Dubai, UAE", temp: 28.0, precip: 100 },
  { name: "Bangkok, Thailand", temp: 28.5, precip: 1500 },
  { name: "Khartoum, Sudan", temp: 30.0, precip: 160 },
];

/**
 * Nearest present-day climate analog for a projected climate, matched on annual
 * mean temperature and precipitation (weighted so ~1.5°C ≈ ~200 mm). Excludes
 * the queried location itself by name.
 */
export function climateTwin(avgTemp: number, annualPrecip: number, excludeName?: string): string {
  const tempScale = 1.5;
  const precipScale = 200;
  const exclude = (excludeName || "").toLowerCase();
  // The first token of the location name (the city) for self-exclusion.
  const excludeCity = exclude.split(",")[0].trim();

  let best: CityNormal | null = null;
  let bestDist = Infinity;
  for (const c of CITY_NORMALS) {
    const cityName = c.name.split(",")[0].trim().toLowerCase();
    if (excludeCity && (cityName === excludeCity || exclude.includes(cityName))) continue;
    const dt = (c.temp - avgTemp) / tempScale;
    const dp = (c.precip - annualPrecip) / precipScale;
    const dist = dt * dt + dp * dp;
    if (dist < bestDist) { bestDist = dist; best = c; }
  }
  return best ? best.name : "—";
}
