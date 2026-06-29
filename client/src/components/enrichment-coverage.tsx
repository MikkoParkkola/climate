import { CalendarOff, MapPinOff, Ban, Info } from "lucide-react";
import { BORDER, MUTED, AMBER } from "@/lib/climate-constants";
import type { CoverageStatus } from "@/lib/climate-types";

// Explicit empty-states for grounded enrichments. A blank widget reads as
// "broken" even when the data is honestly absent (Rams #4 — understandable),
// so every null enrichment renders a labeled reason here instead of nothing.
// When the backend supplies a nearestScenario, we show that real adjacent
// value clearly labeled as a substitute, with styling distinct from the
// primary numbers so it is never mistaken for the selected-scenario value.

type StatusMeta = { label: string; Icon: typeof Info };

const STATUS_META: Record<string, StatusMeta> = {
  unavailable_scenario: { label: "Not published for this scenario", Icon: CalendarOff },
  unavailable_location: { label: "No data for this location", Icon: MapPinOff },
  withheld: { label: "Withheld — no defensible dataset", Icon: Ban },
  available: { label: "Available", Icon: Info },
};

export function EnrichmentEmptyState({
  coverage,
  fallback,
  accent = AMBER,
}: {
  coverage?: CoverageStatus | null;
  // Honest fallback copy used when the backend has not (yet) supplied a
  // structured coverageStatus, so the section is never silently blank.
  fallback: string;
  accent?: string;
}) {
  const meta = (coverage?.status && STATUS_META[coverage.status]) || { label: "Not shown here", Icon: Info };
  const reason = coverage?.reason ?? fallback;
  const nearest = coverage?.nearestScenario;
  const Icon = meta.Icon;

  return (
    <div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "3px 9px", borderRadius: 999, border: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.03)", marginBottom: 9 }}>
        <Icon style={{ width: 13, height: 13, color: MUTED }} />
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.03em", color: MUTED, textTransform: "uppercase" }}>{meta.label}</span>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.58, color: MUTED }}>{reason}</p>

      {nearest && (
        <div style={{ marginTop: 10, padding: "9px 11px", borderRadius: 8, border: `1px dashed ${accent}66`, background: `${accent}0c` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: accent }}>Nearest available · context only</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.82)" }}>{nearest.scenario}</span>
            {nearest.value != null && nearest.value !== "" && (
              <span style={{ fontSize: 13, fontWeight: 800, fontStyle: "italic", color: accent }}>{nearest.value}</span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: MUTED }}>
            {nearest.note ?? "Shown as adjacent-scenario context, not a value for the selected scenario."}
            {coverage?.servedScenario ? ` (no published value for ${coverage.servedScenario}).` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
