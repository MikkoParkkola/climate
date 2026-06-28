import {
  ACCENT, BG, BLUE, BORDER, MUTED, RED, MONTHS,
  BASELINE_YEAR, MAX_YEAR, CURRENT_FORECAST_YEAR,
} from "@/lib/climate-constants";
import { interpArr } from "@/lib/climate-helpers";

export function ReceiptDetails({ label = "source", text }: { label?: string; text: string }) {
  return (
    <details style={{ display: "inline-block", maxWidth: "100%" }}>
      <summary
        aria-label={`${label}: ${text}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: 18,
          cursor: "pointer",
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: MUTED,
          border: `1px solid ${BORDER}`,
          borderRadius: 999,
          padding: "2px 6px",
          userSelect: "none",
        }}
      >
        {label}
      </summary>
      <div
        role="note"
        style={{
          marginTop: 6,
          maxWidth: 340,
          padding: "8px 9px",
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          background: "rgba(6,9,16,0.94)",
          color: "rgba(255,255,255,0.78)",
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        {text}
      </div>
    </details>
  );
}

export function ChartValuesDetails({
  label,
  rows,
}: {
  label: string;
  rows: { year: number; value: string; range?: string }[];
}) {
  return (
    <details style={{ display: "inline-block", maxWidth: "100%" }}>
      <summary
        aria-label={`${label} annual values table`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: 18,
          cursor: "pointer",
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: MUTED,
          border: `1px solid ${BORDER}`,
          borderRadius: 999,
          padding: "2px 6px",
          userSelect: "none",
        }}
      >
        values
      </summary>
      <div
        role="note"
        style={{
          marginTop: 6,
          maxWidth: 300,
          maxHeight: 220,
          overflow: "auto",
          padding: "8px 9px",
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          background: "rgba(6,9,16,0.94)",
          color: "rgba(255,255,255,0.78)",
          fontSize: 11,
          lineHeight: 1.45,
        }}
      >
        <div style={{ marginBottom: 6, color: MUTED }}>
          Displayed yearly values are linearly interpolated between grounded API checkpoints.
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", color: MUTED, fontWeight: 600, padding: "2px 0" }}>Year</th>
              <th style={{ textAlign: "right", color: MUTED, fontWeight: 600, padding: "2px 0" }}>Value</th>
              <th style={{ textAlign: "right", color: MUTED, fontWeight: 600, padding: "2px 0" }}>Range</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year}>
                <td style={{ padding: "2px 0", borderTop: `1px solid ${BORDER}` }}>{row.year}</td>
                <td style={{ padding: "2px 0", borderTop: `1px solid ${BORDER}`, textAlign: "right", color: "white" }}>{row.value}</td>
                <td style={{ padding: "2px 0", borderTop: `1px solid ${BORDER}`, textAlign: "right", color: row.range ? "white" : MUTED }}>{row.range || "n/a"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ── Charts ─────────────────────────────────────────────────────────────────
export interface TrendZone { from: number; to: number; color: string }

export function TrendChart({
  years, values, year, label, unit, color, decimals = 0, thresholdY, zones, fillOpacity = 0.1,
  lowValues, highValues, uncertaintyLabel, scenarioLabel, thresholdLabel,
}: {
  years: number[]; values: number[]; year: number; label: string; unit: string; color: string;
  decimals?: number; thresholdY?: number; zones?: TrendZone[]; fillOpacity?: number;
  lowValues?: number[]; highValues?: number[]; uncertaintyLabel?: string; scenarioLabel?: string; thresholdLabel?: string;
}) {
  const VW = 100, VH = 56, px = 1, py = 5, bH = 9;
  const cW = VW - px * 2, cH = VH - py - bH;
  const hasRange = lowValues?.length === values.length && highValues?.length === values.length &&
    lowValues.every(Number.isFinite) && highValues.every(Number.isFinite);
  const rangeLow = hasRange ? lowValues!.map((v, i) => Math.min(v, highValues![i])) : [];
  const rangeHigh = hasRange ? lowValues!.map((v, i) => Math.max(v, highValues![i])) : [];
  const annualYears = Array.from({ length: MAX_YEAR - BASELINE_YEAR + 1 }, (_, i) => BASELINE_YEAR + i);
  const annualValues = annualYears.map((yr) => interpArr(years, values, yr));
  const annualLow = hasRange ? annualYears.map((yr) => interpArr(years, rangeLow, yr)) : [];
  const annualHigh = hasRange ? annualYears.map((yr) => interpArr(years, rangeHigh, yr)) : [];
  const scaleValues = hasRange ? [...annualValues, ...annualLow, ...annualHigh] : annualValues;
  const mn = Math.min(...scaleValues), mx = Math.max(...scaleValues), rng = mx - mn || 1;
  const xOf = (yr: number) => px + ((yr - BASELINE_YEAR) / (MAX_YEAR - BASELINE_YEAR)) * cW;
  const yOf = (v: number) => py + cH - ((v - mn) / rng) * cH;
  const fmt = (v: number) => (decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString());
  const withUnit = (v: number) => `${fmt(v)}${unit}`;

  const curV = interpArr(years, values, year);
  const curLow = hasRange ? interpArr(years, rangeLow, year) : null;
  const curHigh = hasRange ? interpArr(years, rangeHigh, year) : null;
  const mrkX = xOf(year);
  const mrkY = yOf(curV);
  const pts = annualValues.map((v, i) => `${xOf(annualYears[i]).toFixed(2)},${yOf(v).toFixed(2)}`).join(" ");
  const areaD = `M${xOf(years[0]).toFixed(2)},${(py + cH).toFixed(2)}` +
    annualValues.map((v, i) => ` L${xOf(annualYears[i]).toFixed(2)},${yOf(v).toFixed(2)}`).join("") +
    ` L${xOf(years[years.length - 1]).toFixed(2)},${(py + cH).toFixed(2)}Z`;
  const rangeD = hasRange
    ? `M${annualHigh.map((v, i) => `${xOf(annualYears[i]).toFixed(2)},${yOf(v).toFixed(2)}`).join(" L")} ` +
      `L${annualLow.map((v, i) => `${xOf(annualYears[i]).toFixed(2)},${yOf(v).toFixed(2)}`).reverse().join(" L")}Z`
    : "";

  const callW = 26, callH = 11;
  const cxPos = mrkX + 2 + callW > VW - px ? mrkX - 2 - callW : mrkX + 2;
  const cyPos = Math.max(0, Math.min(VH - bH - callH, mrkY - callH / 2));
  const displayV = fmt(curV);
  const displayRange = hasRange && curLow !== null && curHigh !== null ? `${fmt(curLow)}-${fmt(curHigh)}${unit}` : null;
  const thresholdInRange = thresholdY !== undefined && thresholdY >= mn && thresholdY <= mx;
  const thresholdTextY = thresholdInRange ? Math.max(py + 4, Math.min(py + cH - 1, yOf(thresholdY!) - 1)) : 0;
  const sourceYears = new Set(years);
  const axisYears = Array.from(new Set([BASELINE_YEAR, CURRENT_FORECAST_YEAR, 2050, 2075, MAX_YEAR]))
    .filter((yr) => yr >= BASELINE_YEAR && yr <= MAX_YEAR);
  const pointLabel = (i: number) => {
    const yr = annualYears[i];
    const value = withUnit(annualValues[i]);
    const range = hasRange ? `, range ${withUnit(annualLow[i])} to ${withUnit(annualHigh[i])}` : "";
    const source = sourceYears.has(yr) ? "grounded API checkpoint" : "linear interpolation between grounded API checkpoints";
    return `${label} ${yr}: ${value}${range}. ${source}${scenarioLabel ? `, ${scenarioLabel}` : ""}.`;
  };
  const valueRows = annualYears.map((yr, i) => ({
    year: yr,
    value: withUnit(annualValues[i]),
    range: hasRange ? `${withUnit(annualLow[i])} to ${withUnit(annualHigh[i])}` : undefined,
  }));

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        role="img"
        aria-label={`${label} trend from ${BASELINE_YEAR} to ${MAX_YEAR}${scenarioLabel ? `, ${scenarioLabel}` : ""}. Displayed yearly points are linearly interpolated between grounded API checkpoints.${thresholdLabel ? ` Threshold marker: ${thresholdLabel}.` : ""}`}
        style={{ width: "100%", height: 80, display: "block" }}
      >
        <title>{`${label} trend. Hover plotted yearly points for values; open the values disclosure below for keyboard and touch access.`}</title>
        {zones?.map((z, zi) => {
          const clampedHi = Math.min(z.to, mx), clampedLo = Math.max(z.from, mn);
          if (clampedHi <= clampedLo) return null;
          return <rect key={zi} x={px} y={yOf(clampedHi)} width={cW} height={yOf(clampedLo) - yOf(clampedHi)} fill={z.color} opacity="0.14" />;
        })}
        {hasRange && <path d={rangeD} fill={color} opacity="0.18" />}
        <path d={areaD} fill={color} opacity={fillOpacity} />
        {[0.33, 0.67].map((f) => {
          const yy = py + f * cH;
          return <line key={f} x1={px} y1={yy} x2={px + cW} y2={yy} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />;
        })}
        {thresholdInRange && (
          <g>
            <title>{thresholdLabel ?? `Threshold marker at ${withUnit(thresholdY!)}`}</title>
            <line x1={px} y1={yOf(thresholdY!)} x2={px + cW} y2={yOf(thresholdY!)} stroke={RED} strokeWidth="0.7" strokeDasharray="2 1.5" opacity="0.6" />
            {thresholdLabel && (
              <text x={VW - px - 0.5} y={thresholdTextY} textAnchor="end" fill={RED} fontSize="4.5" fontWeight="700">
                {thresholdLabel}
              </text>
            )}
          </g>
        )}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <line x1={mrkX} y1={py} x2={mrkX} y2={py + cH} stroke={ACCENT} strokeWidth="0.9" strokeDasharray="2.5 2" opacity="0.85" />
        {hasRange && curLow !== null && curHigh !== null && (
          <line x1={mrkX} y1={yOf(curHigh)} x2={mrkX} y2={yOf(curLow)} stroke={color} strokeWidth="2.2" strokeLinecap="round" opacity="0.32" />
        )}
        {annualYears.map((yr, i) => (
          <circle
            key={yr}
            cx={xOf(yr)}
            cy={yOf(annualValues[i])}
            r={sourceYears.has(yr) ? "0.95" : "0.65"}
            fill={color}
            opacity={sourceYears.has(yr) ? "0.44" : "0.2"}
          >
            <title>{pointLabel(i)}</title>
          </circle>
        ))}
        <circle cx={mrkX} cy={mrkY} r="2.4" fill={color} stroke="white" strokeWidth="0.9" />
        <rect x={cxPos} y={cyPos} width={callW} height={callH} rx="2" fill="rgba(6,9,16,0.88)" stroke={color} strokeWidth="0.5" />
        <text x={cxPos + callW / 2} y={cyPos + callH - 2.5} textAnchor="middle" fill="white" fontSize="5.5" fontWeight="700">{displayV}{unit}</text>
        {axisYears.map((yr) => (
          <text key={yr} x={xOf(yr)} y={VH - 0.5} textAnchor="middle" fill={MUTED} fontSize="4.8">{yr}</text>
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginTop: 2, padding: "0 1px" }}>
        <span style={{ minWidth: 0, display: "inline-flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
          {scenarioLabel && <span style={{ fontSize: 8, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 999, padding: "1px 5px" }}>{scenarioLabel}</span>}
          <ChartValuesDetails label={label} rows={valueRows} />
          {hasRange && uncertaintyLabel && <ReceiptDetails label="range" text={uncertaintyLabel} />}
          {thresholdLabel && <ReceiptDetails label="threshold" text={`Dashed marker: ${thresholdLabel}. It is a chart reference for the displayed metric, not a property-level or safety-critical decision boundary.`} />}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: "monospace", textAlign: "right", flexShrink: 0 }}>
          {displayV}{unit}
          {displayRange && <span style={{ display: "block", fontSize: 8, color: MUTED, fontWeight: 600 }}>range {displayRange}</span>}
        </span>
      </div>
    </div>
  );
}

export function MonthlyTempChart({ temps, baseline }: { temps: number[]; baseline: number[] }) {
  const W = 480, H = 140, px = 24, py = 12;
  const all = [...temps, ...baseline];
  const min = Math.floor(Math.min(...all) - 2);
  const max = Math.ceil(Math.max(...all) + 2);
  const range = max - min || 1;
  const cW = W - px * 2, cH = H - py * 2 - 14;
  const xp = (i: number) => px + (i / 11) * cW;
  const yp = (v: number) => py + cH - ((Math.max(min, Math.min(max, v)) - min) / range) * cH;
  const gridVals = Array.from({ length: 5 }, (_, i) => Math.round(min + (range / 4) * i));
  const pts = temps.map((v, i) => `${xp(i)},${yp(v)}`).join(" ");
  const bpts = baseline.map((v, i) => `${xp(i)},${yp(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 140 }}>
      {gridVals.map((t) => (
        <g key={t}>
          <line x1={px} y1={yp(t)} x2={W - px} y2={yp(t)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <text x={px - 3} y={yp(t) + 3} textAnchor="end" fill={MUTED} fontSize="8">{t}°</text>
        </g>
      ))}
      <polyline points={bpts} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeDasharray="4 3" />
      <polyline points={pts} fill="none" stroke={RED} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {temps.map((v, i) => <circle key={i} cx={xp(i)} cy={yp(v)} r="2.5" fill={BG} stroke={RED} strokeWidth="1.5" />)}
      {MONTHS.map((m, i) => <text key={i} x={xp(i)} y={H - 2} textAnchor="middle" fill={MUTED} fontSize="8">{m[0]}</text>)}
    </svg>
  );
}

export function PrecipBars({ vals }: { vals: number[] }) {
  const max = Math.max(...vals, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 110, paddingBottom: 16 }}>
      {vals.map((v, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
          <div style={{ width: "100%", background: `linear-gradient(to top, rgba(59,130,246,0.18), ${BLUE})`, borderRadius: "2px 2px 0 0", height: `${(v / max) * 100}%`, transition: "height 0.25s ease", minHeight: 2 }} />
          <div style={{ fontSize: 8, color: MUTED, marginTop: 2 }}>{MONTHS[i][0]}</div>
        </div>
      ))}
    </div>
  );
}

export function ScoreSparkline({ years, data, color, year }: { years: number[]; data: number[]; color: string; year: number }) {
  const W = 80, H = 22;
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  const xOf = (yr: number) => ((yr - BASELINE_YEAR) / (MAX_YEAR - BASELINE_YEAR)) * W;
  const yOf = (v: number) => H - ((v - mn) / rng) * H * 0.88 + H * 0.06;
  const pts = data.map((v, i) => `${xOf(years[i])},${yOf(v)}`).join(" ");
  const cx = xOf(year);
  const cy = yOf(interpArr(years, data, year));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <circle cx={cx} cy={cy} r="2.5" fill={color} />
    </svg>
  );
}

