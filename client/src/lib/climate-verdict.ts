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

import { BASELINE_YEAR, MAX_YEAR, CURRENT_FORECAST_YEAR } from "./climate-constants";
import { interpScalar, crossYear, categoryFor } from "./climate-helpers";
import type { ProjectionPoint } from "./climate-types";

// Runway zones on the 0-100 habitability score.
export const LIVABLE_FLOOR = 60; // >= 60: livable (green)
export const DANGER_FLOOR = 40; //  < 40: danger (red); 40-60: stressed (amber)

export type HazardKey = "heat" | "drought" | "flood" | "sea" | "cold";

export interface ReasonCode {
  key: HazardKey;
  label: string; // plain heading, e.g. "Extreme heat"
  termKey: string; // glossary key for the tooltip
  severity: number; // 0-10, drives the bar length
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
export function buildReasonCodes(points: ProjectionPoint[]): ReasonCode[] {
  if (points.length === 0) return [];
  const at = (y: number, get: (p: ProjectionPoint) => number) => interpScalar(points, y, get);
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

  const all: ReasonCode[] = [
    {
      key: "heat",
      label: "Extreme heat",
      termKey: "heat_stress_day",
      severity: clamp10(heatEnd / 15), // ~150 dangerously hot days = max
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
      applicable: true,
      direction: dir(droughtEnd, droughtBase),
      text: `Water-shortage pressure scores ${droughtEnd}/100 by 2100 (was ${droughtBase}).`,
    },
    {
      key: "flood",
      label: "Heavy rain & flooding",
      termKey: "flood_risk",
      severity: clamp10(floodEnd / 10),
      applicable: true,
      direction: dir(floodEnd, floodBase),
      text: `Heavy-rain and flood pressure scores ${floodEnd}/100 by 2100 (was ${floodBase}).`,
    },
    {
      key: "sea",
      label: "Sea-level rise",
      termKey: "sea_level_rise",
      severity: seaApplicable ? clamp10(seaEnd / 10) : 0,
      applicable: seaApplicable,
      direction: "rising",
      text: seaApplicable
        ? `Around ${seaEnd} cm of sea-level rise by 2100 for this stretch of coast.`
        : `Not your problem here — this place is too far inland for sea level to matter.`,
    },
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
  const trajectory: Verdict["trajectory"] = delta <= -12 ? "harder" : delta >= 10 ? "easier" : "stable";

  const crossoverYear = crossYear(points, LIVABLE_FLOOR, "below", score);
  const dangerYear = crossYear(points, DANGER_FLOOR, "below", score);
  const crossoverLabel = crossoverYear ? `~${round5(crossoverYear)}` : null;

  const codes = buildReasonCodes(points);
  const applicable = codes.filter((c) => c.applicable).sort((a, b) => b.severity - a.severity);
  const dominant = applicable[0] ?? null;
  const relief = codes.find((c) => !c.applicable) ?? null;
  const reasons = applicable.slice(0, 3);

  // The committed sentence.
  const trajPhrase =
    trajectory === "harder"
      ? "Gets meaningfully harder."
      : trajectory === "easier"
        ? "Actually gets a little easier."
        : "Holds roughly steady.";
  const driverPhrase = dominant
    ? ` ${dominant.label} is what drives it${relief ? `, not the ${relief.label.toLowerCase()}` : ""}.`
    : "";
  const horizonPhrase = crossoverLabel
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
  console.log("\n✅ _selfCheck passed");
}

// tsx runs this when the file is the entry point.
if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
  _selfCheck();
}
