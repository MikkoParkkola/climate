// ── Livability verdict + reason codes ────────────────────────────────────────
// Turns a full grounded trajectory into ONE committed sentence + ≤3 ranked,
// location-specific drivers. This is the bottom line the data browser never gave:
// it answers "where do you want to grow old?" instead of dumping 18 panels.
//
// Honesty rules (THE CARDINAL RULE applies to derived text too):
//  - Crossover is the modeled year the habitability score leaves the livable
//    band on THIS scenario. It is rounded to a 5-year band and labeled as
//    scenario-conditional — never presented as a point prediction.
//  - If the score never leaves the band within the data, we say so plainly and
//    never extrapolate past 2100.
//  - Reason codes are derived from values the model already returns; we add no
//    new coefficients.
//  - The headline's tier wording (steady/harder/easier/already-severe) must
//    come from the SAME score + crossing data that drives endCategory and the
//    tipping-point count elsewhere on the page — never an independently
//    computed slope that can contradict them (AC.VERDICT.8).
//  - "Comfortable until <year>" must never name a year at or before the
//    forecast's own start year; a modeled crossing at/near "now" is phrased
//    as already having happened, not as a future promise (AC.VERDICT.9).

import { BASELINE_YEAR, MAX_YEAR, CURRENT_FORECAST_YEAR } from "./climate-constants";
import { interpScalar, interpOptionalScalar, crossYear, categoryFor, countMonthlyFreezeContext } from "./climate-helpers";
import type { ProjectionPoint } from "./climate-types";

// Runway zones on the 0-100 habitability score.
export const LIVABLE_FLOOR = 60; // >= 60: livable (green)
export const DANGER_FLOOR = 40; //  < 40: danger (red); 40-60: stressed (amber)

// A hazard must clear this severity floor (0-10 shared scale, see
// `scaleNote` below) before it can qualify as a headline driver or the
// dominant reason. Below this, the signal is noise: padding to 3 slots with
// a hazard that scored near-zero is less honest than showing fewer reasons.
// AC.VERDICT.1.
export const REASON_SEVERITY_FLOOR = 1.5;

export type HazardKey = "heat" | "humid_heat" | "cold" | "drought" | "flood" | "sea";

export interface ReasonCode {
  key: HazardKey;
  label: string; // plain heading, e.g. "Extreme heat"
  termKey: string; // glossary key for the tooltip
  severity: number; // 0-10, drives the bar length
  scaleNote: string; // AC.VERDICT.4: what "10" means for THIS hazard -- these
  // bars share a 0-10 axis for layout only; the physical quantities behind
  // them are not commensurable, so every bar carries its own reference point.
  applicable: boolean; // false => "not your problem here" (signal, not noise)
  direction: "rising" | "easing" | "flat";
  text: string; // one plain-language, location-specific line
}

export interface Verdict {
  endCategory: string; // category at 2100
  endScore: number;
  trajectory: "harder" | "stable" | "easier";
  headline: string; // the committed sentence
  crossoverYear: number | null; // year score drops below LIVABLE_FLOOR
  dangerYear: number | null; // year score drops below DANGER_FLOOR
  crossoverLabel: string | null; // "~2060" band, or null if never crosses
  dominant: ReasonCode | null;
  relief: ReasonCode | null; // the reassuring "not here" driver, if any
  reasons: ReasonCode[]; // top-3 applicable, ranked
  personalLine: string | null; // present only when a birth year is supplied
}

function clamp10(n: number): number {
  return Math.max(0, Math.min(10, n));
}

function round5(year: number): number {
  return Math.round(year / 5) * 5;
}

function dir(end: number, base: number): ReasonCode["direction"] {
  const d = end - base;
  if (Math.abs(d) < 1e-6) return "flat";
  return d > 0 ? "rising" : "easing";
}

// Build the ranked hazard drivers from values the model already returns.
// AC.VERDICT.2: covers all 6 computed hazard classes (heat, humid heat, cold
// season, drought, flood, sea level) -- the same 6 rendered in
// climate-result-sections-bottom.tsx -- so the headline can never be blind to
// the dominant real risk. Humid heat is only included when the model exposes
// wet-bulb data for this location/scenario; per THE CARDINAL RULE we never
// fabricate a value where the grounded source doesn't provide one.
export function buildReasonCodes(points: ProjectionPoint[]): ReasonCode[] {
  if (points.length === 0) return [];
  const at = (y: number, get: (p: ProjectionPoint) => number) => interpScalar(points, y, get);
  const atOpt = (y: number, get: (p: ProjectionPoint) => number | undefined) => interpOptionalScalar(points, y, get);
  const baseY = BASELINE_YEAR;
  const endY = MAX_YEAR;
  const seaApplicable = points[0]?.extremes?.sea_level_applicable !== false;

  const heatEnd = Math.round(at(endY, (p) => p.extremes.heat_stress_days));
  const heatBase = Math.round(at(baseY, (p) => p.extremes.heat_stress_days));
  const droughtEnd = Math.round(at(endY, (p) => p.extremes.drought_risk));
  const droughtBase = Math.round(at(baseY, (p) => p.extremes.drought_risk));
  const floodEnd = Math.round(at(endY, (p) => p.extremes.flood_risk));
  const floodBase = Math.round(at(baseY, (p) => p.extremes.flood_risk));
  const seaEnd = Math.round(at(endY, (p) => p.extremes.sea_level_rise_cm ?? 0));

  const humidHeatEnd = atOpt(endY, (p) => p.extremes.detail?.humid_heat?.max_monthly_mean_wet_bulb_c);
  const humidHeatBase = atOpt(baseY, (p) => p.extremes.detail?.humid_heat?.max_monthly_mean_wet_bulb_c);
  const humidHeatAvailable = humidHeatEnd != null && humidHeatBase != null;

  const monthlyTempsAt = (y: number) =>
    Array.from({ length: 12 }, (_, m) => at(y, (p) => p.temperature.monthly?.[m] ?? p.temperature.annual_mean));
  const coldMonthsEnd = countMonthlyFreezeContext(monthlyTempsAt(endY));
  const coldMonthsBase = countMonthlyFreezeContext(monthlyTempsAt(baseY));

  const all: ReasonCode[] = [
    {
      key: "heat",
      label: "Extreme heat",
      termKey: "heat_stress_day",
      severity: clamp10(heatEnd / 15), // ~150 dangerously hot days = max
      scaleNote: "150 dangerously hot days/yr = 10",
      applicable: true,
      direction: dir(heatEnd, heatBase),
      text:
        heatEnd > 0
          ? `About ${heatEnd} dangerously hot days a year by 2100 (was ~${heatBase} today).`
          : `Dangerous heat isn't a big factor here.`,
    },
    {
      key: "drought",
      label: "Drought",
      termKey: "drought_risk",
      severity: clamp10(droughtEnd / 10),
      scaleNote: "risk score ÷10 (100 = 10)",
      applicable: true,
      direction: dir(droughtEnd, droughtBase),
      text: `Water-shortage pressure scores ${droughtEnd}/100 by 2100 (was ${droughtBase}).`,
    },
    {
      key: "flood",
      label: "Heavy rain & flooding",
      termKey: "flood_risk",
      severity: clamp10(floodEnd / 10),
      scaleNote: "risk score ÷10 (100 = 10)",
      applicable: true,
      direction: dir(floodEnd, floodBase),
      text: `Heavy-rain and flood pressure scores ${floodEnd}/100 by 2100 (was ${floodBase}).`,
    },
    {
      key: "sea",
      label: "Sea-level rise",
      termKey: "sea_level_rise",
      severity: seaApplicable ? clamp10(seaEnd / 10) : 0,
      scaleNote: "100 cm of sea-level rise = 10",
      applicable: seaApplicable,
      direction: "rising",
      text: seaApplicable
        ? `Around ${seaEnd} cm of sea-level rise by 2100 for this stretch of coast.`
        : `Not your problem here — this place is too far inland for sea level to matter.`,
    },
    {
      key: "cold",
      label: "Cold season",
      termKey: "cold_season",
      // 12 freezing months/yr (monthly mean <= 0C) = 10. Everywhere is bounded
      // by 12 months, so this scale never needs an assumed ceiling.
      severity: clamp10(coldMonthsEnd * (10 / 12)),
      scaleNote: "12 freezing months/yr = 10",
      applicable: true,
      // "Rising" would mean more cold, which is a warming-world "easing" of
      // this specific hazard: fewer freezing months as the climate warms.
      direction: coldMonthsEnd === coldMonthsBase ? "flat" : coldMonthsEnd > coldMonthsBase ? "rising" : "easing",
      text:
        coldMonthsEnd > 0
          ? `About ${coldMonthsEnd} months a year average at or below freezing by 2100 (was ${coldMonthsBase} today).`
          : `Freezing winters aren't a big factor here.`,
    },
    ...(humidHeatAvailable
      ? [
          {
            key: "humid_heat" as const,
            label: "Humid heat",
            termKey: "wet_bulb",
            // 20C wet-bulb = comfortable/mild = 0; 35C is the oft-cited
            // theoretical human survivability ceiling = 10.
            severity: clamp10(((humidHeatEnd as number) - 20) * (10 / 15)),
            scaleNote: "20–35°C wet-bulb screen (35 = survivability ceiling)",
            applicable: true,
            direction: dir(humidHeatEnd as number, humidHeatBase as number),
            text: `Warmest-month wet-bulb screen reaches ${(humidHeatEnd as number).toFixed(1)}°C by 2100 (was ${(humidHeatBase as number).toFixed(1)}°C today).`,
          },
        ]
      : []),
  ];

  return all;
}

export interface VerdictOptions {
  birthYear?: number; // client-side only; never sent to the server
}

export function buildVerdict(points: ProjectionPoint[], opts: VerdictOptions = {}): Verdict | null {
  if (points.length === 0) return null;
  const at = (y: number, get: (p: ProjectionPoint) => number) => interpScalar(points, y, get);

  const score = (p: ProjectionPoint) => p.habitability.score;
  const scoreBase = at(BASELINE_YEAR, score);
  const endScore = Math.round(Math.max(0, Math.min(100, at(MAX_YEAR, score))));
  const endCategory = categoryFor(endScore);

  const delta = endScore - scoreBase;

  const crossoverYear = crossYear(points, LIVABLE_FLOOR, "below", score);
  const dangerYear = crossYear(points, DANGER_FLOOR, "below", score);

  // AC.VERDICT.9: a crossing at or before "now" (the forecast's own start
  // year) is something that has ALREADY happened, not a future promise --
  // and 5-year-band rounding must never round a still-future year down into
  // one that reads as past. Comparisons use the raw (unrounded) year so this
  // is exact, not a rounding artifact.
  const crossoverAlready = crossoverYear !== null && crossoverYear <= CURRENT_FORECAST_YEAR;
  const dangerAlready = dangerYear !== null && dangerYear <= CURRENT_FORECAST_YEAR;
  const crossoverLabel = (() => {
    if (crossoverYear === null || crossoverAlready) return null;
    const rounded = round5(crossoverYear);
    // Only ever push the band label LATER (never earlier) to keep it clear of
    // "now" -- pushing earlier could round a real future crossing back into
    // the past; pushing later at most costs one 5-year bucket of precision,
    // which this label already trades away by design.
    return `~${rounded > CURRENT_FORECAST_YEAR ? rounded : Math.ceil((CURRENT_FORECAST_YEAR + 1) / 5) * 5}`;
  })();

  // AC.VERDICT.8: the tier phrase must agree with endCategory/dangerAlready --
  // the same score + crossing data driving the rest of the page -- instead of
  // an independently computed slope that can contradict a "Severe" score or
  // already-crossed tipping points with a "steady" headline.
  //  - "already" (dangerAlready/crossoverAlready) is a claim about NOW, using
  //    the exact same crossing check as the tipping-point count.
  //  - "ends severe/stressed" is a claim about the 2100 end state, using the
  //    same endCategory the score badge shows -- distinct from "already" so we
  //    never tell a user something is wrong today when it's a 2100 outcome.
  const endsSevere = endCategory === "Severe";
  const endsStressed = !endsSevere && endCategory === "Poor";
  let trajectory: Verdict["trajectory"];
  if (dangerAlready || endsSevere) trajectory = "harder";
  else if (crossoverAlready || endsStressed) trajectory = delta >= 10 ? "easier" : "harder";
  else trajectory = delta <= -12 ? "harder" : delta >= 10 ? "easier" : "stable";

  const codes = buildReasonCodes(points);
  const applicable = codes
    .filter((c) => c.applicable && c.severity >= REASON_SEVERITY_FLOOR)
    .sort((a, b) => b.severity - a.severity);
  const dominant = applicable[0] ?? null;
  // AC.VERDICT.3: relief is the hazard that is LEAST relevant for THIS
  // location -- prefer one the model says is geographically inapplicable
  // (e.g. sea level inland), else fall back to whichever computed hazard
  // scored lowest here. Never a fixed default.
  const inapplicable = codes.filter((c) => !c.applicable);
  const bySeverityAsc = [...codes].sort((a, b) => a.severity - b.severity);
  const relief = inapplicable[0] ?? bySeverityAsc.find((c) => c !== dominant) ?? null;
  const reasons = applicable.slice(0, 3);

  // The committed sentence.
  const trajPhrase = dangerAlready
    ? "Already in the danger zone."
    : crossoverAlready
      ? "Already outside the comfortable band."
      : endsSevere
        ? "Ends in the danger zone by 2100."
        : endsStressed
          ? "Ends outside the comfortable band by 2100."
          : trajectory === "harder"
            ? "Gets meaningfully harder."
            : trajectory === "easier"
              ? "Actually gets a little easier."
              : "Holds roughly steady.";
  const driverPhrase = dominant
    ? ` ${dominant.label} is what drives it${relief ? `, not the ${relief.label.toLowerCase()}` : ""}.`
    : "";
  const horizonPhrase = dangerAlready || crossoverAlready
    ? ""
    : crossoverLabel
      ? ` Stays comfortable until ${crossoverLabel} on this scenario.`
      : " Stays in the livable band through 2100 on this scenario.";
  const headline = `${trajPhrase}${driverPhrase}${horizonPhrase}`;

  // Personal horizon — only if the user opted to share a birth year (client-side).
  let personalLine: string | null = null;
  if (opts.birthYear && Number.isFinite(opts.birthYear)) {
    const ageNow = CURRENT_FORECAST_YEAR - opts.birthYear;
    if (ageNow > 0 && ageNow < 120) {
      if (crossoverYear) {
        const ageThen = crossoverYear - opts.birthYear;
        personalLine =
          ageThen > 0
            ? `You're about ${ageNow} now — you'd be roughly ${ageThen} when it leaves the comfortable band.`
            : `It already sits outside the comfortable band today.`;
      } else {
        personalLine = `You're about ${ageNow} now — it stays in the comfortable band for the rest of the century.`;
      }
    }
  }

  return {
    endCategory,
    endScore,
    trajectory,
    headline,
    crossoverYear,
    dangerYear,
    crossoverLabel,
    dominant,
    relief,
    reasons,
    personalLine,
  };
}

// ── Runnable self-check (ponytail: one check that fails if the logic breaks) ──
// Run: npx tsx client/src/lib/climate-verdict.ts
export function _selfCheck(): void {
  const mk = (year: number, s: number, heat: number, drought: number, flood: number): ProjectionPoint =>
    ({
      year,
      temperature: { annual_mean: 15, monthly: [], anomaly: 0, min: 0, max: 0 },
      precipitation: { annual_total: 500, monthly: [], anomaly_percent: 0 },
      extremes: {
        heat_stress_days: heat,
        drought_risk: drought,
        flood_risk: flood,
        sea_level_rise_cm: 0,
        sea_level_applicable: false, // inland (Madrid-like)
      },
      habitability: { score: s },
    }) as ProjectionPoint;

  // Inland, heat-led decline: 78 -> 45 over the century.
  const madrid = [mk(2025, 78, 20, 30, 20), mk(2060, 62, 70, 50, 22), mk(2100, 45, 115, 65, 25)];
  const v = buildVerdict(madrid, { birthYear: 1986 });
  if (!v) throw new Error("verdict was null");
  console.log("headline:", v.headline);
  console.log("personal:", v.personalLine);
  console.log("crossover:", v.crossoverLabel, "danger:", v.dangerYear);
  console.log(
    "reasons:",
    v.reasons.map((r) => `${r.label} sev=${r.severity.toFixed(1)} ${r.direction}`).join(" | "),
  );
  console.log("relief:", v.relief?.label, "-", v.relief?.text);

  if (v.trajectory !== "harder") throw new Error(`expected harder, got ${v.trajectory}`);
  if (v.dominant?.key !== "heat") throw new Error(`expected heat dominant, got ${v.dominant?.key}`);
  if (v.relief?.key !== "sea") throw new Error(`expected sea relief, got ${v.relief?.key}`);
  if (!v.crossoverLabel) throw new Error("expected a crossover band");
  if (!v.personalLine?.includes("40")) throw new Error(`expected age ~40 in personal line: ${v.personalLine}`);

  // AC.VERDICT.5: synthetic location where humid heat is the dominant
  // computed hazard -- everything else (heat-stress days, drought, flood,
  // cold, sea level) stays negligible/inapplicable while wet-bulb pushes
  // from mild to near the survivability ceiling. The verdict must name
  // "Humid heat" as the driver, not silently fall back to heat/drought/
  // flood/sea -- that fallback is exactly the bug AC.VERDICT.2/5 close.
  const mkHumid = (year: number, s: number, wetBulb: number): ProjectionPoint =>
    ({
      year,
      temperature: { annual_mean: 26, monthly: Array(12).fill(26), anomaly: 0, min: 20, max: 30 },
      precipitation: { annual_total: 1800, monthly: [], anomaly_percent: 0 },
      extremes: {
        heat_stress_days: 5,
        drought_risk: 5,
        flood_risk: 8,
        sea_level_rise_cm: 3,
        sea_level_applicable: false, // inland-ish so sea can't be the (false) dominant
        detail: { humid_heat: { max_monthly_mean_wet_bulb_c: wetBulb } },
      },
      habitability: { score: s },
    }) as ProjectionPoint;
  const humidCity = [mkHumid(2025, 70, 24), mkHumid(2060, 55, 29), mkHumid(2100, 38, 33.5)];
  const vh = buildVerdict(humidCity);
  if (!vh) throw new Error("humid-heat verdict was null");
  console.log("\nhumid headline:", vh.headline);
  if (vh.dominant?.key !== "humid_heat")
    throw new Error(`expected humid_heat dominant, got ${vh.dominant?.key}`);
  if (!vh.headline.includes("Humid heat"))
    throw new Error(`expected headline to name Humid heat: ${vh.headline}`);

  console.log("\n✅ _selfCheck passed");
}

// tsx runs this when the file is the entry point.
if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
  _selfCheck();
}
