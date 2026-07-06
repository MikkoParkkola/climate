// "What changes here" — turn a location's grounded projection into a few
// concrete, human local-change statements (MIK-6798). Every value comes from a
// model field the result already shows; nothing is invented. Where a field is
// absent or the change is negligible, the statement is omitted (blank-not-guess,
// DESIGN.md §4) rather than padded.

export interface LocalChangeInput {
  year: number;
  tempChange: number; // °C of warming vs the present-day baseline
  heatDays: number;
  baseHeatDays: number;
  coldMonthCount: number; // months/yr at or below freezing (projected)
  baselineColdMonthCount: number; // ... today
  drought: number; // 0-100 risk score
  flood: number; // 0-100 risk score
  seaLevelRiseCm?: number | null;
  seaLevelApplicable?: boolean;
}

export type ChangeTone = "heat" | "cold" | "wet" | "dry" | "sea" | "warm";

export interface LocalChange {
  key: string;
  label: string; // short headline, e.g. "Dangerous-heat days"
  detail: string; // one plain sentence
  tone: ChangeTone;
}

const round = (n: number) => Math.round(n);

export function deriveLocalChanges(d: LocalChangeInput): LocalChange[] {
  const out: LocalChange[] = [];

  // Warming (always meaningful if > 0.3°C).
  const warm = d.tempChange;
  if (Number.isFinite(warm) && warm >= 0.3) {
    out.push({
      key: "warming",
      label: "Average warming",
      detail: `About ${warm.toFixed(1)}°C warmer on average by ${d.year} than today.`,
      tone: "warm",
    });
  }

  // Dangerous-heat days gained.
  const heat = d.heatDays - d.baseHeatDays;
  if (Number.isFinite(heat) && heat >= 3) {
    out.push({
      key: "heat",
      label: "Dangerous-heat days",
      detail: `Roughly ${round(heat)} more dangerous-heat days a year than today (${round(d.baseHeatDays)} → ${round(d.heatDays)}).`,
      tone: "heat",
    });
  }

  // Freezing months lost (winters shrinking).
  const coldLost = d.baselineColdMonthCount - d.coldMonthCount;
  if (Number.isFinite(coldLost) && coldLost >= 1) {
    out.push({
      key: "cold",
      label: "Freezing months",
      detail: `About ${round(coldLost)} fewer month${round(coldLost) === 1 ? "" : "s"} a year at or below freezing — shorter, milder winters.`,
      tone: "cold",
    });
  }

  // Sea-level rise, only where the coastal screen says it's locally relevant.
  if (d.seaLevelApplicable && d.seaLevelRiseCm != null && Number.isFinite(d.seaLevelRiseCm) && d.seaLevelRiseCm >= 5) {
    out.push({
      key: "sea",
      label: "Sea-level rise",
      detail: `Around +${round(d.seaLevelRiseCm)} cm of regional sea-level rise by ${d.year}.`,
      tone: "sea",
    });
  }

  // Drought / flood pressure — only surface the dominant one, and only when high.
  if (Number.isFinite(d.drought) && d.drought >= 60 && d.drought >= d.flood) {
    out.push({
      key: "drought",
      label: "Drought pressure",
      detail: `Water-shortage pressure runs high (${round(d.drought)}/100) by ${d.year}.`,
      tone: "dry",
    });
  } else if (Number.isFinite(d.flood) && d.flood >= 60) {
    out.push({
      key: "flood",
      label: "Flood pressure",
      detail: `Heavy-rain and flood pressure runs high (${round(d.flood)}/100) by ${d.year}.`,
      tone: "wet",
    });
  }

  return out;
}

// ── runnable self-check: npx tsx client/src/lib/local-changes.ts ──────────────
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }

export function _selfCheck() {
  // A hot, drying, ice-losing future produces heat + warming + lost-winter + drought.
  const hot = deriveLocalChanges({
    year: 2100, tempChange: 6, heatDays: 40, baseHeatDays: 8,
    coldMonthCount: 0, baselineColdMonthCount: 3, drought: 72, flood: 20,
    seaLevelRiseCm: 0, seaLevelApplicable: false,
  });
  const keys = hot.map((c) => c.key);
  assert(keys.includes("warming"), "expected warming");
  assert(keys.includes("heat"), "expected heat");
  assert(keys.includes("cold"), "expected lost-winter");
  assert(keys.includes("drought"), "expected drought");
  assert(!keys.includes("flood"), "drought dominates flood, flood should be omitted");
  assert(!keys.includes("sea"), "sea not applicable here");

  // A negligible-change case yields nothing (blank-not-guess, no padding).
  const flat = deriveLocalChanges({
    year: 2035, tempChange: 0.1, heatDays: 8, baseHeatDays: 8,
    coldMonthCount: 3, baselineColdMonthCount: 3, drought: 20, flood: 20,
  });
  assert(flat.length === 0, `flat future should yield no cards, got ${flat.length}`);

  // Coastal case surfaces sea-level.
  const coast = deriveLocalChanges({
    year: 2100, tempChange: 2, heatDays: 10, baseHeatDays: 9,
    coldMonthCount: 2, baselineColdMonthCount: 2, drought: 10, flood: 10,
    seaLevelRiseCm: 59, seaLevelApplicable: true,
  });
  assert(coast.some((c) => c.key === "sea"), "expected sea-level card on the coast");

  console.log(`✅ local-changes _selfCheck passed (hot=${hot.length} flat=${flat.length} coast=${coast.length})`);
}

if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
  _selfCheck();
}
