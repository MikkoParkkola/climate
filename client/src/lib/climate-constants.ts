import type { CSSProperties } from "react";
import type { ScenarioId } from "./climate-types";

// ── Theme: "field report" — warm ink, ember accent, opaque hairline panels ──
export const BG = "hsl(222,16%,8%)";
export const CARD = "hsl(222,15%,12%)";
export const BORDER = "hsl(220,13%,22%)";
export const ACCENT = "hsl(24,88%,56%)";
export const MUTED = "hsl(220,9%,63%)";
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

// Emissions scenarios. `short` is the plain-language name a normal visitor reads;
// `label` is the scientific acronym kept for the niche/expert audience and shown in
// parentheses after the plain name (see scenarioOptionLabel). `caption` is a one-line
// plain explanation that includes the headline warming level. `warming` is the IPCC
// AR6 best-estimate global warming by 2081–2100 vs 1850–1900 (WG1 SPM Table SPM.1).
// SINGLE SOURCE OF TRUTH — pages import this, never re-declare it, so the wording
// can't drift across the landing, comparison and rankings views.
export const SCENARIOS = [
  { id: "ssp126", short: "Strong climate action", label: "SSP1-2.6", warming: "~1.8°C", caption: "If the world cuts emissions hard and fast. About 1.8°C of global warming by 2100.", realism: "About 1.8°C by 2100. Strong, fast emission cuts in line with the Paris goal. Achievable, but ahead of what today's policies deliver." },
  { id: "ssp245", short: "Roughly today's policies", label: "SSP2-4.5", warming: "~2.7°C", caption: "Close to where current policies point, not the best case nor the worst. About 2.7°C of global warming by 2100.", realism: "About 2.7°C by 2100. Closest to current policies, where the world is actually heading on present trends. This is the default view." },
  { id: "ssp370", short: "High emissions", label: "SSP3-7.0", warming: "~3.6°C", caption: "If emissions keep climbing and climate action stalls. About 3.6°C of global warming by 2100.", realism: "About 3.6°C by 2100. A fragmented world where climate cooperation stalls. A real risk if progress reverses, not the central expectation." },
  { id: "ssp585", short: "Very high emissions", label: "SSP5-8.5", warming: "~4.4°C", caption: "A worst-case stress test, now seen as unlikely. About 4.4°C of global warming by 2100.", realism: "About 4.4°C by 2100. High-end worst case, now considered unlikely. Useful as a stress test; mainstream science no longer treats it as business as usual (Hausfather and Peters, Nature 2020)." },
] as const;

// Best-estimate global warming figures are IPCC AR6 (2081-2100 vs pre-industrial).
// Current-policy band cites Climate Action Tracker (Nov 2025) and UNEP Emissions
// Gap Report 2025; shown near the scenario selector so the default is honest.
export const CURRENT_POLICIES_BAND =
  "Where current policies point: roughly 2.6 to 2.8°C by 2100. The Climate Action Tracker puts current policies at 2.6°C (Nov 2025); the UN Emissions Gap Report 2025 puts them at 2.8°C. Full delivery of national pledges would lower this to about 2.3 to 2.5°C, but a wide gap remains between what governments promise and what they have enacted.";

// Plain name first, acronym in parentheses for the experts: "Roughly today's policies (SSP2-4.5)".
export function scenarioOptionLabel(s: { short: string; label: string }): string {
  return `${s.short} (${s.label})`;
}

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
