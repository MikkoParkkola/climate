// ── Livability Runway — the hero ──────────────────────────────────────────────
// One glance answers "where do you want to grow old?": a committed verdict
// sentence, a glowing now→2100 gauge whose color IS the habitability trajectory
// (livable → stressed → danger), the comfortable-band crossover, an optional
// lifetime marker, and ≤3 ranked, location-specific drivers. Warm Instrument
// style: warm ink, ember glow, Fraunces display + Space Mono data.

import {
  ACCENT, AMBER, BORDER, CARD, FONT_DISPLAY, FONT_MONO, GREEN, MUTED, RED,
  CURRENT_FORECAST_YEAR, MAX_YEAR,
} from "@/lib/climate-constants";
import { interpScalar, crossYear } from "@/lib/climate-helpers";
import { buildVerdict, DANGER_FLOOR, LIVABLE_FLOOR, type ReasonCode } from "@/lib/climate-verdict";
import type { ProjectionPoint, ScenarioId } from "@/lib/climate-types";
import type { GlossaryKey } from "@/lib/glossary";
import { Term } from "@/components/climate-term";
import { ReceiptDetails } from "@/components/climate-charts";

function zoneColor(score: number): string {
  return score >= LIVABLE_FLOOR ? GREEN : score >= DANGER_FLOOR ? AMBER : RED;
}

const SAMPLES = 28;

export function LivabilityRunway({
  points,
  locationName,
  birthYear,
  scenarioLabel,
  scenarios,
  onLoadScenarios,
  scenariosLoading,
}: {
  points: ProjectionPoint[];
  locationName: string;
  birthYear?: number;
  scenarioLabel: string;
  scenarios?: Partial<Record<ScenarioId, ProjectionPoint[]>> | null;
  onLoadScenarios?: () => void;
  scenariosLoading?: boolean;
}) {
  const verdict = buildVerdict(points, { birthYear });
  if (!verdict || points.length === 0) return null;

  const startYear = Math.max(CURRENT_FORECAST_YEAR, points[0].year);
  const span = Math.max(1, MAX_YEAR - startYear);
  const pos = (year: number) => `${Math.max(0, Math.min(100, ((year - startYear) / span) * 100))}%`;

  // The gauge fill: sample the score along the century, color each step by zone.
  const stops: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const y = startYear + (span * i) / SAMPLES;
    const s = interpScalar(points, y, (p) => p.habitability.score);
    stops.push(`${zoneColor(s)} ${((i / SAMPLES) * 100).toFixed(1)}%`);
  }
  const gauge = `linear-gradient(90deg, ${stops.join(", ")})`;

  // Scenario band: the spread of comfortable-band crossover years across the four
  // emission paths — the honest uncertainty. "Comfortable until X–Y, depending on
  // how much the world emits." Only computed once all four are loaded.
  const scenarioCrossovers = scenarios
    ? (Object.keys(scenarios) as ScenarioId[])
        .map((id) => {
          const pts = scenarios[id];
          return pts && pts.length ? crossYear(pts, LIVABLE_FLOOR, "below", (p) => p.habitability.score) : null;
        })
        .filter((y): y is number => y != null)
    : [];
  const bandLow = scenarioCrossovers.length ? Math.min(...scenarioCrossovers) : null;
  const bandHigh = scenarioCrossovers.length ? Math.max(...scenarioCrossovers) : null;
  const hasBand = bandLow != null && bandHigh != null && bandHigh > bandLow;
  const round5 = (y: number) => Math.round(y / 5) * 5;

  const dominant = verdict.dominant;
  const limitedBy = dominant ? `${dominant.label.toLowerCase()}-limited` : verdict.endCategory.toLowerCase();

  return (
    <section
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        padding: "22px 22px 20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* faint ember bloom, top-right — the instrument's glow */}
      <div
        aria-hidden
        style={{
          position: "absolute", top: -60, right: -40, width: 220, height: 220, borderRadius: "50%",
          background: `radial-gradient(circle, ${ACCENT}22 0%, transparent 70%)`, pointerEvents: "none",
        }}
      />

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>
          {locationName}
        </h2>
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {limitedBy}
        </span>
      </div>

      {/* the committed verdict */}
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, lineHeight: 1.4, color: "white", margin: "12px 0 4px", maxWidth: 640 }}>
        {verdict.headline}
      </p>
      {verdict.personalLine && (
        <p style={{ fontSize: 13.5, color: MUTED, margin: "0 0 4px", maxWidth: 640 }}>{verdict.personalLine}</p>
      )}

      {/* ── the runway gauge ── */}
      <div style={{ marginTop: 20, marginBottom: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 11, color: MUTED, marginBottom: 6 }}>
          <span>{startYear}</span>
          <span style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>{scenarioLabel} path</span>
          <span>{MAX_YEAR}</span>
        </div>

        <div style={{ position: "relative", height: 14 }}>
          {/* gauge bar */}
          <div
            style={{
              position: "absolute", inset: 0, borderRadius: 7, background: gauge,
              boxShadow: `0 0 18px ${ACCENT}33, inset 0 0 0 1px rgba(255,255,255,0.06)`,
              transformOrigin: "left", animation: "fill-grow 0.3s ease",
            }}
          />
          {/* scenario band: spread of crossover years across the emission paths */}
          {hasBand && (
            <div style={{ position: "absolute", top: -4, bottom: -4, left: pos(bandLow!), width: `calc(${pos(bandHigh!)} - ${pos(bandLow!)})`, background: `${AMBER}26`, border: `1px solid ${AMBER}55`, borderRadius: 4 }} />
          )}
          {/* crossover tick (leaves comfortable band) */}
          {verdict.crossoverYear && (
            <Marker left={pos(verdict.crossoverYear)} color={AMBER} />
          )}
          {/* danger tick */}
          {verdict.dangerYear && <Marker left={pos(verdict.dangerYear)} color={RED} />}
          {/* lifetime diamond */}
          {birthYear && verdict.crossoverYear && (
            <Diamond left={pos(verdict.crossoverYear)} />
          )}
        </div>

        {/* labels under the gauge */}
        <div style={{ position: "relative", height: 30, marginTop: 4, fontFamily: FONT_MONO, fontSize: 10.5 }}>
          {verdict.crossoverYear && (
            <div style={{ position: "absolute", left: pos(verdict.crossoverYear), transform: "translateX(-50%)", textAlign: "center", color: AMBER, whiteSpace: "nowrap" }}>
              <Term k="crossover">{verdict.crossoverLabel}</Term>
              {birthYear && (
                <div style={{ color: MUTED }}>you're ~{verdict.crossoverYear - birthYear}</div>
              )}
            </div>
          )}
          {/* AC.VISUAL.4 (MIK-6779): the danger tick above was color-only (RED,
              no adjacent text) -- invisible to color-blind readers. Give it the
              same text-label treatment the crossover tick already has. Only
              render this label when it wouldn't sit on top of the crossover
              one (crossover always precedes danger on the timeline; if they
              round to the same 5-year bucket, skip the danger label rather
              than overlap two centered strings). */}
          {verdict.dangerYear && round5(verdict.dangerYear) !== (verdict.crossoverYear ? round5(verdict.crossoverYear) : null) && (
            <div style={{ position: "absolute", left: pos(verdict.dangerYear), transform: "translateX(-50%)", textAlign: "center", color: RED, whiteSpace: "nowrap" }}>
              danger ~{round5(verdict.dangerYear)}
            </div>
          )}
        </div>

        {/* legend */}
        <div style={{ display: "flex", gap: 14, fontFamily: FONT_MONO, fontSize: 10, color: MUTED, marginTop: 2 }}>
          <Legend color={GREEN} label="livable" />
          <Legend color={AMBER} label="stressed" />
          <Legend color={RED} label="danger" />
          <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.35)" }}>
            color = <Term k="habitability_score">habitability score</Term> over time
          </span>
        </div>

        {scenarios ? (
          hasBand ? (
            // AC.VISUAL.5 (MIK-6779): this copy used to be one fixed phrase
            // regardless of how far out the crossing sits. Emission paths
            // barely diverge in the near term (the physics hasn't had time to
            // separate them yet) but diverge a lot by end-of-century -- so a
            // near-term band is a fairly solid read, while a 40-year-out band
            // is real but genuinely wide open. Say so, instead of implying the
            // same confidence both times.
            bandLow! - CURRENT_FORECAST_YEAR <= 15 ? (
              <div style={{ marginTop: 9, fontSize: 12.5, color: MUTED, lineHeight: 1.4 }}>
                Across all four <Term k="emissions_scenario">emission paths</Term>, it leaves the comfortable band soon — between{" "}
                <strong style={{ color: "#fff" }}>{round5(bandLow!)}</strong> and{" "}
                <strong style={{ color: "#fff" }}>{round5(bandHigh!)}</strong>. This close in, the paths haven't had time to diverge, so this window is fairly solid.
              </div>
            ) : (
              <div style={{ marginTop: 9, fontSize: 12.5, color: MUTED, lineHeight: 1.4 }}>
                Across all four <Term k="emissions_scenario">emission paths</Term>, it leaves the comfortable band somewhere between{" "}
                <strong style={{ color: "#fff" }}>{round5(bandLow!)}</strong> and{" "}
                <strong style={{ color: "#fff" }}>{round5(bandHigh!)}</strong> — the lower the emissions, the later. This far out, the paths have had decades to diverge, so treat the width of that range, not either single year, as the honest answer.
              </div>
            )
          ) : (
            <div style={{ marginTop: 9, fontSize: 12.5, color: MUTED, lineHeight: 1.4 }}>
              The four <Term k="emissions_scenario">emission paths</Term> don't separate much here — the path the world takes barely moves the date for this place.
            </div>
          )
        ) : onLoadScenarios ? (
          <button type="button" onClick={onLoadScenarios} disabled={scenariosLoading} className="press"
            style={{ marginTop: 10, padding: "7px 12px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.04)", color: scenariosLoading ? MUTED : ACCENT, fontSize: 12, cursor: scenariosLoading ? "wait" : "pointer" }}>
            {scenariosLoading ? "Loading all four paths…" : "Compare all four emission paths →"}
          </button>
        ) : null}
      </div>

      {/* ── reason codes ── */}
      <div style={{ marginTop: 18, display: "grid", gap: 9 }}>
        {verdict.reasons.map((r) => (
          <ReasonRow key={r.key} reason={r} />
        ))}
        {verdict.relief && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: 0.7 }}>
            <span style={{ width: 132, flexShrink: 0, fontSize: 12.5, color: MUTED }}>
              <Term k={verdict.relief.termKey as GlossaryKey}>{verdict.relief.label}</Term>
            </span>
            <span style={{ fontSize: 12, color: MUTED, fontStyle: "italic" }}>{verdict.relief.text}</span>
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
        <ReceiptDetails
          label="how this is figured"
          text={`The verdict reads the grounded habitability score (0-100) from the CMIP6 / IPCC AR6 grid for this exact place, year by year to 2100. The "comfortable until" year is the modeled year that score drops below 60 on the shown scenario, rounded to 5 years - a scenario-conditional projection, not a prediction. Drivers are ranked from the model's own heat, drought, flood and sea-level outputs. Nothing here is invented; if a value is not grounded, it is not shown.`}
        />
      </div>
    </section>
  );
}

function Marker({ left, color }: { left: string; color: string }) {
  return (
    <div
      aria-hidden
      style={{ position: "absolute", left, top: -3, bottom: -3, width: 2, transform: "translateX(-50%)", background: color, boxShadow: `0 0 6px ${color}` }}
    />
  );
}

function Diamond({ left }: { left: string }) {
  return (
    <div
      aria-label="your lifetime marker"
      style={{
        position: "absolute", left, top: "50%", width: 11, height: 11,
        transform: "translate(-50%,-50%) rotate(45deg)",
        background: "#f7e9d2", border: `1.5px solid ${ACCENT}`, boxShadow: `0 0 8px ${ACCENT}`,
      }}
    />
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}

function ReasonRow({ reason }: { reason: ReasonCode }) {
  const arrow = reason.direction === "rising" ? "▲" : reason.direction === "easing" ? "▼" : "—";
  const arrowColor = reason.direction === "rising" ? RED : reason.direction === "easing" ? GREEN : MUTED;
  const pct = `${(reason.severity / 10) * 100}%`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 132, flexShrink: 0, fontSize: 12.5, color: "white", fontWeight: 600 }}>
        <Term k={reason.termKey as GlossaryKey}>{reason.label}</Term>
      </span>
      <span
        title={`0-10 scale: ${reason.scaleNote}`}
        style={{ position: "relative", flex: "0 0 88px", height: 7, background: "rgba(255,255,255,0.07)", borderRadius: 4, overflow: "hidden" }}
      >
        <span style={{ position: "absolute", inset: 0, width: pct, background: `linear-gradient(90deg, ${AMBER}, ${ACCENT})`, borderRadius: 4, transformOrigin: "left", animation: "fill-grow 0.3s ease" }} />
      </span>
      <span style={{ width: 14, flexShrink: 0, color: arrowColor, fontSize: 11 }}>{arrow}</span>
      <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.35 }}>{reason.text}</span>
    </div>
  );
}
