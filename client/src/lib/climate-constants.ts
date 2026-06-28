import type { CSSProperties } from "react";
import type { ScenarioId } from "./climate-types";

// ── Theme: "field report" — warm ink, ember accent, opaque hairline panels ──
export const BG = "hsl(28,13%,8%)";
export const CARD = "hsl(28,13%,11.5%)";
export const BORDER = "hsl(34,12%,22%)";
export const ACCENT = "hsl(24,88%,56%)";
export const MUTED = "hsl(38,11%,60%)";
export const RED = "hsl(6,72%,57%)";
export const BLUE = "hsl(200,45%,58%)";
export const ORANGE = "hsl(28,82%,56%)";
export const GREEN = "hsl(150,38%,50%)";
export const AMBER = "hsl(38,72%,56%)";
export const PURPLE = "hsl(280,30%,66%)";
export const CYAN = "hsl(200,48%,58%)";
export const FONT_DISPLAY = "'Fraunces', Georgia, serif";
export const FONT_MONO = "'Space Mono', ui-monospace, monospace";
export const card: CSSProperties = { backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: 4 };

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const BASELINE_YEAR = 2025;
export const MAX_YEAR = 2100;
export const CURRENT_FORECAST_YEAR = Math.min(MAX_YEAR, Math.max(BASELINE_YEAR + 1, new Date().getFullYear()));
export const FIVE_YEAR_CHECKPOINTS = Array.from({ length: 15 }, (_, i) => 2030 + i * 5).filter((year) => year >= CURRENT_FORECAST_YEAR);
export const CHECKPOINTS = Array.from(new Set([BASELINE_YEAR, CURRENT_FORECAST_YEAR, ...FIVE_YEAR_CHECKPOINTS])).sort((a, b) => a - b);
export const YEAR_TICKS = CHECKPOINTS;
export const QUICK_YEAR_BUTTONS = Array.from(new Set([CURRENT_FORECAST_YEAR, 2030, 2050, 2075, 2100].filter((year) => year >= CURRENT_FORECAST_YEAR)));
export const ROADMAP_YEARS = Array.from(new Set([CURRENT_FORECAST_YEAR, 2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100].filter((year) => year >= CURRENT_FORECAST_YEAR && year <= MAX_YEAR))).sort((a, b) => a - b);
export const FREEZING_MONTHLY_MEAN_C = 0;

export const SCENARIOS = [
  { id: "ssp126", label: "SSP1-2.6", caption: "low emissions; strong mitigation" },
  { id: "ssp245", label: "SSP2-4.5", caption: "middle path; current-policy-adjacent reference" },
  { id: "ssp370", label: "SSP3-7.0", caption: "high emissions; weak mitigation stress case" },
  { id: "ssp585", label: "SSP5-8.5", caption: "very high emissions; low-likelihood stress test" },
] as const;

export const DEFAULT_SCENARIO: ScenarioId = "ssp245";
export const DEFAULT_SCENARIO_POLICY_VERSION = "current-policy-reference-2025";
export const DEFAULT_SCENARIO_EXPLANATION =
  "Default reference: 2025 UNEP current-policy and Climate Action Tracker policies/action estimates put end-century warming roughly between 2.6 C and just below 3 C, so fupit maps the reference case to the closest fully grounded SSP pathway. It is a versioned reference, not a prediction or hidden scenario average.";

export const SCENARIO_LINE_COLORS: Record<ScenarioId, string> = {
  ssp126: GREEN,
  ssp245: BLUE,
  ssp370: ORANGE,
  ssp585: PURPLE,
};
