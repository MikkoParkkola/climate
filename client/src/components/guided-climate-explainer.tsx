import type { CSSProperties, ReactNode } from "react";

export interface GuidedClimateExplainerDriver {
  label: string;
  movement: string;
  effect: number;
}

export interface GuidedClimateExplainerSignal {
  label: string;
  value: string;
  color: string;
  text: string;
  receipt: string;
}

export interface GuidedClimateExplainerRoadmapItem {
  year: number;
  category: string;
  tempChange: number;
  heatDays: number;
  precipChange: number;
  score: number;
  driver: {
    label: string;
    text: string;
    color: string;
  };
  scenarioDelta?: string;
}

export interface GuidedClimateExplainerTwin {
  name: string;
  country: string;
  distance: number;
  comparedCount: number;
  matchLabel: "strong" | "moderate" | "weak" | "none";
  sigma: number;
  noAnalog: boolean;
  annualTempDelta: number;
  annualPrecipDelta: number;
  heatDaysDelta: number;
}

interface GuidedClimateExplainerProps {
  placeName: string;
  year: number;
  scenarioLabel: string;
  scenarioCaption: string;
  tempChange: number;
  ipccDelta: number;
  heatDays: number;
  heatDelta: number;
  precipChange: number;
  score: number;
  category: string;
  topDriver?: GuidedClimateExplainerDriver;
  dailyLifeSignals: GuidedClimateExplainerSignal[];
  roadmapItems: GuidedClimateExplainerRoadmapItem[];
  climateTwin?: GuidedClimateExplainerTwin | null;
  scenarioContrastText?: string | null;
  hasScenarioContrast: boolean;
  sourceCount: number;
}

const BORDER = "rgba(255,255,255,0.08)";
const MUTED = "hsl(215,20%,65%)";
const RED = "#ef4444";
const ORANGE = "#f97316";
const BLUE = "#3b82f6";
const GREEN = "#22c55e";
// AC.VISUAL.2 (MIK-6779): PURPLE ("#a78bfa") used to be declared here but was
// never referenced anywhere in this file -- dead code that also happened to
// carry a hue DESIGN.md bans from chrome outright ("never in buttons,
// accents, or the favicon"). Removed rather than swapped for another color,
// since there is no semantic role to preserve. (BLUE above stays: it colors
// the rainfall/precipitation figure at line ~156, the "reads as water"
// carve-out DESIGN.md explicitly allows.)

const panelStyle: CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.04)",
  border: `1px solid ${BORDER}`,
  borderLeft: `3px solid ${GREEN}`,
  borderRadius: 12,
  padding: 18,
  backdropFilter: "blur(12px)",
};

function signed(value: number, decimals = 1) {
  const rounded = value.toFixed(decimals);
  return value >= 0 ? `+${rounded}` : rounded;
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ color: GREEN, fontSize: 12, fontWeight: 900, minWidth: 20 }}>{number}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ margin: 0, color: "white", fontSize: 14, fontWeight: 850 }}>{title}</h3>
          <div style={{ marginTop: 7 }}>{children}</div>
        </div>
      </div>
    </section>
  );
}

export default function GuidedClimateExplainer({
  placeName,
  year,
  scenarioLabel,
  scenarioCaption,
  tempChange,
  ipccDelta,
  heatDays,
  heatDelta,
  precipChange,
  score,
  category,
  topDriver,
  dailyLifeSignals,
  roadmapItems,
  climateTwin,
  scenarioContrastText,
  hasScenarioContrast,
  sourceCount,
}: GuidedClimateExplainerProps) {
  const firstRoadmap = roadmapItems[0];
  const lastRoadmap = roadmapItems[roadmapItems.length - 1];
  const visibleSignals = dailyLifeSignals.slice(0, 4);
  const heatPhrase = heatDelta >= 0
    ? `${Math.round(heatDelta)} more heat-stress days than the baseline`
    : `${Math.abs(Math.round(heatDelta))} fewer heat-stress days than the baseline`;
  const driverText = topDriver
    ? `${topDriver.label} ${topDriver.movement}; that visible component moves the score by ${signed(topDriver.effect, 1)} points.`
    : "No single visible score component dominates this horizon.";

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ flex: "1 1 420px" }}>
          <h2 style={{ margin: 0, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Guided explainer</h2>
          <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.72)", fontSize: 12.5, lineHeight: 1.6 }}>
            A classroom-friendly reading path for {placeName}'s {year} projection. Every statement below is derived from the visible forecast fields, roadmap, source trail, and bounded climate-twin catalog.
          </p>
        </div>
        <div style={{ textAlign: "right", minWidth: 160 }}>
          <div style={{ color: MUTED, fontSize: 10, textTransform: "uppercase" }}>Pathway</div>
          <div style={{ color: "white", fontSize: 15, fontWeight: 900 }}>{scenarioLabel}</div>
          <div style={{ color: MUTED, fontSize: 10.5, marginTop: 2 }}>{scenarioCaption}</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <Section number="1" title="Read the trend before the snapshot">
          <p style={{ margin: 0, color: "rgba(255,255,255,0.78)", fontSize: 12.5, lineHeight: 1.65 }}>
            By {year}, raw local warming is <strong style={{ color: RED }}>{signed(tempChange, 1)}C</strong>, while the IPCC-assessed context shown beside it is <strong style={{ color: "#f59e0b" }}>{signed(ipccDelta, 1)}C</strong>. Heat stress reaches <strong style={{ color: ORANGE }}>{heatDays} days/year</strong>, or {heatPhrase}. Rainfall shifts <strong style={{ color: BLUE }}>{signed(precipChange, 1)}%</strong>. Habitability is <strong style={{ color: GREEN }}>{score}/100 ({category})</strong>.
          </p>
          {firstRoadmap && lastRoadmap && (
            <p style={{ margin: "7px 0 0", color: MUTED, fontSize: 11.5, lineHeight: 1.55 }}>
              Roadmap frame: {firstRoadmap.year} starts at {signed(firstRoadmap.tempChange, 1)}C raw warming and {firstRoadmap.score}/100; {lastRoadmap.year} reaches {signed(lastRoadmap.tempChange, 1)}C and {lastRoadmap.score}/100.
            </p>
          )}
        </Section>

        <Section number="2" title="Translate it into daily life questions">
          <div style={{ display: "grid", gap: 8 }}>
            {visibleSignals.map((signal) => (
              <div key={signal.label} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 180px) minmax(0, 1fr)", gap: 10, alignItems: "start" }}>
                <div style={{ color: signal.color, fontSize: 11.5, fontWeight: 850 }}>
                  {signal.label}
                  <div style={{ color: MUTED, fontSize: 10, fontWeight: 650, marginTop: 1 }}>{signal.value}</div>
                </div>
                <div style={{ color: "rgba(255,255,255,0.74)", fontSize: 11.5, lineHeight: 1.5 }}>{signal.text}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section number="3" title="Ask what is driving the score">
          <p style={{ margin: 0, color: "rgba(255,255,255,0.78)", fontSize: 12.5, lineHeight: 1.65 }}>
            {driverText}
          </p>
          <p style={{ margin: "7px 0 0", color: MUTED, fontSize: 11.5, lineHeight: 1.55 }}>
            This is score-component movement, not a full causal model. Freshwater systems, biodiversity, health systems, governance, migration, conflict, adaptation quality, and parcel-level exposure still need separate registered data before they can become quantified metrics.
          </p>
        </Section>

        <Section number="4" title="Compare pathways and analogs">
          <p style={{ margin: 0, color: "rgba(255,255,255,0.78)", fontSize: 12.5, lineHeight: 1.65 }}>
            {hasScenarioContrast && scenarioContrastText
              ? scenarioContrastText
              : "Load the same-location pathway contrast to see how lower and higher warming alter this exact place. Without that contrast, this panel shows only the currently selected scenario."}
          </p>
          <p style={{ margin: "7px 0 0", color: MUTED, fontSize: 11.5, lineHeight: 1.55 }}>
            {climateTwin
              ? (climateTwin.noAnalog
                  ? `Climate twin: no present-day city in this ${climateTwin.comparedCount}-city catalog closely matches ${placeName}'s ${year} climate, so fupit reports no twin rather than forcing a misleading match.`
                  : `Climate twin: ${placeName}'s ${year} climate is a ${climateTwin.matchLabel} match for ${climateTwin.name}, ${climateTwin.country} today, out of a ${climateTwin.comparedCount}-city catalog. Gaps: ${signed(climateTwin.annualTempDelta, 1)}C temperature, ${signed(climateTwin.annualPrecipDelta, 0)} mm rainfall, ${signed(climateTwin.heatDaysDelta, 0)} heat-stress days.`)
              : "Climate twin is bounded to the loaded catalog and may be unavailable while data is loading; it is not a global analog search."}
          </p>
        </Section>

        <Section number="5" title="Inspect the evidence and limits">
          <p style={{ margin: 0, color: "rgba(255,255,255,0.78)", fontSize: 12.5, lineHeight: 1.65 }}>
            The selected projection exposes {sourceCount} source-trail row{sourceCount === 1 ? "" : "s"} in the Projection Receipt. Treat missing domains as missing: this panel does not add unregistered freshwater, crop, biodiversity, wildfire, insurance, medical, engineering, or safe-haven claims.
          </p>
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer", color: GREEN, fontSize: 11, fontWeight: 850 }}>Classroom prompts</summary>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: MUTED, fontSize: 11.5, lineHeight: 1.6 }}>
              <li>Which line changes steadily, and which one changes in steps or reversals?</li>
              <li>Which visible metric would affect daily routines first?</li>
              <li>Which missing local dataset would you need before making a real-world decision?</li>
            </ul>
          </details>
        </Section>
      </div>
    </div>
  );
}
