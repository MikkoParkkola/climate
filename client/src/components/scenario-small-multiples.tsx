import type { CSSProperties } from "react";

export interface ScenarioSmallMultipleSeries {
  id: string;
  label: string;
  role: string;
  color: string;
  years: number[];
  values: number[];
  active?: boolean;
}

export interface ScenarioSmallMultipleMetric {
  id: string;
  label: string;
  unit: string;
  color: string;
  decimals: number;
  thresholdY?: number;
  thresholdLabel?: string;
  receipt: string;
  series: ScenarioSmallMultipleSeries[];
}

interface ScenarioSmallMultiplesProps {
  metrics: ScenarioSmallMultipleMetric[];
  selectedYear: number;
  startYear: number;
  endYear: number;
}

const BORDER = "rgba(255,255,255,0.08)";
const MUTED = "hsl(215,20%,65%)";
const ACCENT = "hsl(24,88%,56%)"; // ember — DESIGN.md §1: ember owns the accent, never blue
const RED = "#ef4444";

const panelStyle: CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  background: "rgba(255,255,255,0.028)",
  padding: 10,
  minWidth: 0,
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function interpArr(years: number[], values: number[], year: number): number {
  if (values.length === 0) return 0;
  if (year <= years[0]) return values[0];
  if (year >= years[years.length - 1]) return values[values.length - 1];
  for (let i = 0; i < years.length - 1; i++) {
    if (year >= years[i] && year <= years[i + 1]) {
      const t = (year - years[i]) / (years[i + 1] - years[i] || 1);
      return lerp(values[i], values[i + 1], t);
    }
  }
  return values[values.length - 1];
}

function fmt(value: number, unit: string, decimals: number) {
  return `${decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString()}${unit}`;
}

function pathFromPoints(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

function ScenarioMetricPanel({
  metric,
  selectedYear,
  startYear,
  endYear,
}: {
  metric: ScenarioSmallMultipleMetric;
  selectedYear: number;
  startYear: number;
  endYear: number;
}) {
  const VW = 100;
  const VH = 58;
  const px = 3;
  const py = 5;
  const axisH = 9;
  const cW = VW - px * 2;
  const cH = VH - py - axisH;
  const annualYears = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
  const series = metric.series
    .map((line) => ({
      ...line,
      annualValues: annualYears.map((year) => interpArr(line.years, line.values, year)),
      selectedValue: interpArr(line.years, line.values, selectedYear),
      sourceYears: new Set(line.years),
    }))
    .filter((line) => line.values.length > 0 && line.annualValues.every(Number.isFinite));

  if (series.length === 0) return null;

  const scaleValues = series.flatMap((line) => line.annualValues);
  if (metric.thresholdY !== undefined) scaleValues.push(metric.thresholdY);
  const mn = Math.min(...scaleValues);
  const mx = Math.max(...scaleValues);
  const rng = mx - mn || 1;
  const xOf = (year: number) => px + ((year - startYear) / (endYear - startYear || 1)) * cW;
  const yOf = (value: number) => py + cH - ((value - mn) / rng) * cH;
  const selectedX = xOf(selectedYear);
  const axisYears = Array.from(new Set([startYear, selectedYear, 2050, 2075, endYear]))
    .filter((year) => year >= startYear && year <= endYear);
  const thresholdInRange = metric.thresholdY !== undefined && metric.thresholdY >= mn && metric.thresholdY <= mx;

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", marginBottom: 6 }}>
        <div>
          <div style={{ color: "white", fontSize: 12.5, fontWeight: 850 }}>{metric.label}</div>
          <div style={{ color: MUTED, fontSize: 9.5, lineHeight: 1.35 }}>Annual scenario lines, same coordinates</div>
        </div>
        {metric.thresholdLabel && <span style={{ color: RED, fontSize: 8.5, fontWeight: 800 }}>{metric.thresholdLabel}</span>}
      </div>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        role="img"
        aria-label={`${metric.label} scenario small multiple from ${startYear} to ${endYear}. Lines are annual values linearly interpolated between grounded API checkpoints for the same coordinates.`}
        style={{ width: "100%", height: 98, display: "block" }}
      >
        <title>{`${metric.label}. Hover yearly points for values; open selected-year values below for keyboard and touch access.`}</title>
        {[0.33, 0.67].map((f) => {
          const yy = py + f * cH;
          return <line key={f} x1={px} y1={yy} x2={px + cW} y2={yy} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />;
        })}
        {thresholdInRange && (
          <g>
            <title>{metric.thresholdLabel ?? `Threshold marker at ${fmt(metric.thresholdY!, metric.unit, metric.decimals)}`}</title>
            <line x1={px} y1={yOf(metric.thresholdY!)} x2={px + cW} y2={yOf(metric.thresholdY!)} stroke={RED} strokeWidth="0.7" strokeDasharray="2 1.5" opacity="0.62" />
          </g>
        )}
        {series.map((line) => {
          const points = line.annualValues.map((value, index) => ({ x: xOf(annualYears[index]), y: yOf(value) }));
          const selectedValue = line.selectedValue;
          const selectedY = yOf(selectedValue);
          return (
            <g key={line.id}>
              <polyline points={pathFromPoints(points)} fill="none" stroke={line.color} strokeWidth={line.active ? "2.1" : "1.35"} strokeLinecap="round" strokeLinejoin="round" opacity={line.active ? 0.98 : 0.68} />
              {annualYears.map((annualYear, index) => (
                <circle
                  key={`${line.id}-${annualYear}`}
                  cx={points[index].x}
                  cy={points[index].y}
                  r={line.sourceYears.has(annualYear) ? "0.8" : "0.48"}
                  fill={line.color}
                  opacity={line.sourceYears.has(annualYear) ? 0.38 : 0.12}
                >
                  <title>{`${line.label} ${metric.label} ${annualYear}: ${fmt(line.annualValues[index], metric.unit, metric.decimals)}. ${line.sourceYears.has(annualYear) ? "Grounded API checkpoint" : "Linear interpolation between grounded API checkpoints"}.`}</title>
                </circle>
              ))}
              <circle cx={selectedX} cy={selectedY} r={line.active ? "2.25" : "1.75"} fill={line.color} stroke="white" strokeWidth="0.65">
                <title>{`${line.label} selected year ${selectedYear}: ${fmt(selectedValue, metric.unit, metric.decimals)}.`}</title>
              </circle>
            </g>
          );
        })}
        <line x1={selectedX} y1={py} x2={selectedX} y2={py + cH} stroke={ACCENT} strokeWidth="0.75" strokeDasharray="2.5 2" opacity="0.78" />
        {axisYears.map((axisYear) => (
          <text key={axisYear} x={xOf(axisYear)} y={VH - 0.5} textAnchor="middle" fill={MUTED} fontSize="4.7">{axisYear}</text>
        ))}
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
        {series.map((line) => (
          <span key={line.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9, color: line.active ? "white" : MUTED, border: `1px solid ${line.active ? `${line.color}66` : BORDER}`, borderRadius: 999, padding: "2px 6px" }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: line.color, display: "inline-block" }} />
            {line.label}
          </span>
        ))}
      </div>
      <details style={{ marginTop: 7, fontSize: 10, color: MUTED }}>
        <summary style={{ cursor: "pointer", color: MUTED }}>Selected-year values and receipt</summary>
        <div style={{ marginTop: 6, lineHeight: 1.45 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", fontWeight: 700, padding: "2px 0" }}>Pathway</th>
                <th style={{ textAlign: "right", fontWeight: 700, padding: "2px 0" }}>{selectedYear}</th>
              </tr>
            </thead>
            <tbody>
              {series.map((line) => (
                <tr key={line.id}>
                  <td style={{ padding: "2px 0", borderTop: `1px solid ${BORDER}`, color: line.active ? "white" : MUTED }}>{line.label}</td>
                  <td style={{ padding: "2px 0", borderTop: `1px solid ${BORDER}`, color: "white", textAlign: "right", fontFamily: "monospace" }}>{fmt(line.selectedValue, metric.unit, metric.decimals)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ margin: "6px 0 0" }}>{metric.receipt}</p>
        </div>
      </details>
    </div>
  );
}

export default function ScenarioSmallMultiples({
  metrics,
  selectedYear,
  startYear,
  endYear,
}: ScenarioSmallMultiplesProps) {
  if (metrics.length === 0) return null;

  return (
    <div aria-label="Scenario small multiples for all key metrics" style={{ margin: "12px 0 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 8 }}>
        <div>
          <h3 style={{ fontSize: 12, fontWeight: 850, color: "white", margin: 0 }}>Scenario small multiples · all key metrics</h3>
          <p style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.5, margin: "3px 0 0" }}>
            Same place, same years, each supported SSP pathway. Fine-grained annual lines are interpolated between grounded API checkpoints.
          </p>
        </div>
        <span style={{ fontSize: 10, color: MUTED }}>Marker: {selectedYear}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        {metrics.map((metric) => (
          <ScenarioMetricPanel key={metric.id} metric={metric} selectedYear={selectedYear} startYear={startYear} endYear={endYear} />
        ))}
      </div>
    </div>
  );
}
