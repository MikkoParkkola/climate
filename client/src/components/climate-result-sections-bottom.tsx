import { GitCompare, Loader2, Download, Search, MapPin, ArrowLeft, Play, Pause, ShieldCheck, ExternalLink, Share2, Check } from "lucide-react";
import GuidedClimateExplainer from "@/components/guided-climate-explainer";
import ScenarioSmallMultiples, { type ScenarioSmallMultipleMetric } from "@/components/scenario-small-multiples";
import ScoreSensitivity, { type ScoreSensitivityInput } from "@/components/score-sensitivity";
import {
  BG, CARD, BORDER, ACCENT, MUTED, RED, BLUE, ORANGE, GREEN, AMBER, PURPLE, CYAN,
  FONT_DISPLAY, FONT_MONO, card, MONTHS, BASELINE_YEAR, MAX_YEAR, CURRENT_FORECAST_YEAR,
  YEAR_TICKS, QUICK_YEAR_BUTTONS, FREEZING_MONTHLY_MEAN_C, SCENARIOS, DEFAULT_SCENARIO, DEFAULT_SCENARIO_POLICY_VERSION,
  DEFAULT_SCENARIO_EXPLANATION, SCENARIO_LINE_COLORS,
} from "@/lib/climate-constants";
import {
  riskScore, signedNumber, roundedValue, prettify, confidenceColor, feedbackTag,
  describeSignalLevel, scoreColor, parseScenario,
} from "@/lib/climate-helpers";
import {
  ReceiptDetails, ChartValuesDetails, TrendChart, MonthlyTempChart, PrecipBars, ScoreSparkline,
} from "@/components/climate-charts";

import type { ClimateAppVM } from "@/hooks/use-climate-app";


export default function ClimateResultSectionsBottom({ vm }: { vm: ClimateAppVM }) {
  const {
  locationText, setLocationText, selectedLocation, setSelectedLocation,
  suggestions, showSuggestions, setShowSuggestions, year, scenario, trajectory,
  isLoading, loadingStep, error, exporting, playing, shareCopied, shareStoryCopied,
  shareImageBusy, shareImageSaved, rawJsonCopied, reportSaved, analogCatalog, analogError,
  coastalArtifact, coastalArtifactError, scenarioContrast, scenarioContrastLoading,
  scenarioContrastError, resultsRef,
  traj, d, displayYear, climateAnalog, coastalRelevance, scenarioContrastRows,
  scenarioSmallMultipleMetrics, scenarioContrastTakeaway, roadmapItems, scoreStory,
  scoreSensitivityInputs, dailyLifeSignals, tipping, selectedScenario, shownScenario,
  shareUrl, shareStory, learningPrompts, sc, tPct, maxBreakdown,
  togglePlay, setYearManual, selectLocation, generate, loadScenarioContrast, changeScenario,
  newSearch, exportPDF, openClimateTwinCity, copyShareStory, downloadShareImage, shareForecast,
  buildRawForecastJson, copyRawForecastJson, downloadRawForecastJson,
  buildEducationalReportMarkdown, downloadEducationalReport,
  } = vm;
  const placeName = selectedLocation?.name?.split(",")[0] ?? "This location";
  const heatDelta = d!.heatDays - d!.baseHeatDays;
  const nextTip = tipping.find((t) => t.year != null && (t.year as number) > displayYear);
  const crossedTips = tipping.filter((t) => t.year != null && (t.year as number) <= displayYear).length;

  return (
    <>
        {/* Temperature */}
        <div style={{ ...card, padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Temperature Projection</h2>
            <div style={{ display: "flex", gap: 14, fontSize: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="20" height="3"><line x1="0" y1="1.5" x2="20" y2="1.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
                <span style={{ color: MUTED }}>{BASELINE_YEAR} baseline</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 20, height: 2, background: RED, borderRadius: 1 }} />
                <span style={{ color: MUTED }}>{displayYear}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 158px", gap: 14, alignItems: "start" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { label: "Annual Mean", value: `${d!.avgTemp.toFixed(1)}°C` },
                { label: "Change", value: `+${d!.tempChange.toFixed(1)}°`, color: RED },
                { label: `Min (${MONTHS[d!.minIdx]})`, value: `${d!.monthlyTemps[d!.minIdx].toFixed(1)}°C` },
                { label: `Max (${MONTHS[d!.maxIdx]})`, value: `${d!.monthlyTemps[d!.maxIdx].toFixed(1)}°C` },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 7, padding: "8px 9px" }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", color: MUTED }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: color ?? "white", marginTop: 2 }}>{value}</div>
                </div>
              ))}
            </div>
            <MonthlyTempChart temps={d!.monthlyTemps} baseline={trajectory![0].temperature.monthly} />
            <div>
              <div style={{ fontSize: 10, color: MUTED, marginBottom: 6 }}>Monthly (°C)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 8px" }}>
                {MONTHS.map((m, i) => (
                  <div key={m} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, padding: "2px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ color: MUTED }}>{m}</span>
                    <span style={{ fontFamily: "monospace" }}>{d!.monthlyTemps[i].toFixed(1)}°</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Precipitation */}
        <div style={{ ...card, padding: 18, marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Precipitation Pattern</h2>
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 158px", gap: 14, alignItems: "start" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { label: "Annual Total", value: `${d!.annualPrecip}mm` },
                { label: "Change", value: `${d!.precipChange >= 0 ? "+" : ""}${d!.precipChange.toFixed(1)}%`, color: BLUE },
                { label: "Wettest", value: `${MONTHS[d!.wetIdx]} ${d!.monthlyPrecip[d!.wetIdx]}mm` },
                { label: "Driest", value: `${MONTHS[d!.dryIdx]} ${d!.monthlyPrecip[d!.dryIdx]}mm` },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 7, padding: "8px 9px" }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", color: MUTED }}>{label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: color ?? "white", marginTop: 2 }}>{value}</div>
                </div>
              ))}
            </div>
            <PrecipBars vals={d!.monthlyPrecip} />
            <div>
              <div style={{ fontSize: 10, color: MUTED, marginBottom: 6 }}>Monthly (mm)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 8px" }}>
                {MONTHS.map((m, i) => (
                  <div key={m} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, padding: "2px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ color: MUTED }}>{m}</span>
                    <span style={{ fontFamily: "monospace" }}>{d!.monthlyPrecip[i]}mm</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Risk & Extremes */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 14 }}>
          {[
            {
              label: "Heat Stress",
              value: d!.heatDays,
              unit: "days/yr",
              delta: `+${Math.max(0, d!.heatDays - d!.baseHeatDays)}d`,
              detail: `${roundedValue(d!.heatNightsRaw, " tropical nights/yr")} raw`,
              color: RED,
              receipt: `Heat stress uses the grounded ETCCDI tropical-nights layer for ${shownScenario.label}: nights per year with daily minimum temperature above ${d!.tropicalNightThreshold ?? 20}°C, linearly interpolated to the selected year. Ensemble spread: ${roundedValue(d!.heatNightsSpread, " days", 1)}. This is a climate screening indicator, not medical or occupational-safety advice.`,
            },
            {
              label: "Humid heat screen",
              value: d!.humidHeatWetBulb == null ? "n/a" : `${d!.humidHeatWetBulb.toFixed(1)}°C`,
              unit: "monthly mean wet-bulb",
              sub: d!.humidHeatMonth ?? "max month",
              detail: `${roundedValue(d!.humidHeatRh, "% RH", 1)} · ${signedNumber(d!.humidHeatRhDelta ?? 0, 1)} pp RH`,
              color: d!.humidHeatWetBulb != null && d!.humidHeatWetBulb >= 24 ? RED : ORANGE,
              receipt: `Humid heat screen uses monthly mean air temperature and CMIP6 near-surface relative humidity for ${shownScenario.label}, then applies the registered Stull 2011 empirical wet-bulb approximation. It reports max monthly mean wet-bulb, not WBGT, not daily humid-heat days, and not medical or occupational-safety advice. RH ensemble spread: ${roundedValue(d!.humidHeatRhSpread, " percentage points", 1)}; RH formula-domain clipped months: ${d!.humidHeatClippedMonths ?? 0}; temperature-domain warning months: ${d!.humidHeatTempDomainWarningMonths ?? 0}.`,
            },
            {
              label: "Cold-season context",
              value: d!.coldMonthCount,
              unit: "monthly mean freeze months",
              sub: `${MONTHS[d!.minIdx]} ${d!.monthlyTemps[d!.minIdx].toFixed(1)}°C`,
              detail: `${d!.baselineColdMonthCount} baseline months`,
              color: d!.coldMonthCount >= 3 ? BLUE : d!.coldMonthCount > 0 ? CYAN : GREEN,
              receipt: `Cold-season context uses monthly mean temperature from the grounded trajectory for ${shownScenario.label}. It counts months at or below ${FREEZING_MONTHLY_MEAN_C}°C, not daily freeze days, freeze-thaw events, heating demand, road conditions, crop damage, pests, or health risk.`,
            },
            {
              label: "Drought Risk",
              value: `${d!.drought}%`,
              sub: d!.drought < 25 ? "Low" : d!.drought < 40 ? "Elevated" : "High",
              detail: `${roundedValue(d!.drySpellDays, " dry-spell days")} raw`,
              bar: d!.drought / 100,
              color: AMBER,
              receipt: `Drought risk uses ETCCDI consecutive dry days for ${shownScenario.label}: the longest spell with under 1 mm of rain. The displayed score maps 0 days to 0 and ${roundedValue(d!.droughtMaxCdd, " days")} to 100. Selected raw value: ${roundedValue(d!.drySpellDays, " days", 1)}; ensemble spread: ${roundedValue(d!.drySpellSpread, " days", 1)}. It does not model reservoirs, groundwater, water rights, or demand.`,
            },
            {
              label: "Flood Risk",
              value: `${d!.flood}%`,
              sub: d!.flood < 30 ? "Low" : d!.flood < 60 ? "Elevated" : "High",
              detail: `${roundedValue(d!.maxFiveDayRain, " mm Rx5day")} raw`,
              bar: d!.flood / 100,
              color: BLUE,
              receipt: `Flood risk uses ETCCDI Rx5day for ${shownScenario.label}: maximum 5-day precipitation, a heavy-rain proxy used in IPCC AR6-style assessment. The displayed score maps 0 mm to 0 and ${roundedValue(d!.floodMaxRx5, " mm")} to 100. Selected raw value: ${roundedValue(d!.maxFiveDayRain, " mm", 1)}; ensemble spread: ${roundedValue(d!.maxFiveDayRainSpread, " mm", 1)}. It is not a parcel flood map or insurance loss estimate.`,
            },
            {
              label: "Sea-level context",
              value: `${d!.seaLevel}cm`,
              sub: coastalRelevance?.isLocallyRelevant ? "Coastal screen" : "Regional AR6",
              detail: d!.seaLow != null && d!.seaHigh != null ? `${Math.round(d!.seaLow)}-${Math.round(d!.seaHigh)} cm range` : "range not exposed",
              color: CYAN,
              receipt: `Sea-level context uses the registered NASA/IPCC AR6 regional sea-level layer for ${shownScenario.label}. Selected range: ${d!.seaLow != null && d!.seaHigh != null ? `${Math.round(d!.seaLow)} to ${Math.round(d!.seaHigh)} cm` : "not exposed"}. ${coastalRelevance?.receipt ?? "Coastal relevance is not evaluated, so this is regional context only."}`,
            },
          ].map(({ label, value, unit, delta, sub, detail, bar, color, receipt }) => (
            <div key={label} style={{ ...card, padding: 14, borderTop: `2px solid ${color}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <div style={{ fontSize: 10, color: MUTED }}>{label}</div>
                <ReceiptDetails label="source" text={receipt} />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 6 }}>
                <div>
                  <span style={{ fontSize: 26, fontWeight: 700, color }}>{value}</span>
                  {unit && <span style={{ fontSize: 10, color: MUTED, display: "block", marginTop: -2 }}>{unit}</span>}
                  {detail && <span style={{ fontSize: 9, color: MUTED, display: "block", marginTop: 4 }}>{detail}</span>}
                </div>
                {delta && <span style={{ fontSize: 10, padding: "2px 5px", background: `${RED}20`, color: RED, borderRadius: 4 }}>{delta}</span>}
                {sub && <span style={{ fontSize: 10, fontWeight: 600, color }}>{sub}</span>}
              </div>
              {bar !== undefined && (
                <div style={{ marginTop: 8, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
                  <div style={{ height: "100%", borderRadius: 2, background: color, width: `${Math.min(bar * 100, 100)}%`, transition: "width 0.25s ease" }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Atmospheric Physics */}
        <details style={{ ...card, padding: 18, marginBottom: 14 }}>
          <summary style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", listStyle: "none" }}>
            <span style={{ fontSize: 18 }}>⚛️</span>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 600, margin: 0 }}>Atmospheric Physics</h3>
            <span style={{ marginLeft: "auto", fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>expand ▾</span>
          </summary>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "2px 18px", marginTop: 12 }}>
            {[
              { label: "Circulation Pattern", value: d!.circulation ?? "—", color: BLUE },
              { label: "Climate Sensitivity", value: d!.sensitivity != null ? `${d!.sensitivity.toFixed(1)}°C per CO₂ doubling` : "—", color: ORANGE },
              { label: "Active Feedbacks", value: d!.feedbacks.length ? d!.feedbacks.map((f) => f.split(":")[0].trim()).join(" · ") : "—", color: PURPLE },
              { label: "Model Confidence", value: prettify(d!.confidence), color: confidenceColor(d!.confidence) },
              { label: "Model", value: d!.modelVersion ? `${d!.model} ${d!.modelVersion}` : d!.model, color: MUTED },
              { label: "Resolution", value: d!.resolution ?? "—", color: MUTED },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 6, marginBottom: 6, fontSize: 11 }}>
                <span style={{ color: MUTED, flexShrink: 0 }}>{label}</span>
                <span style={{ fontWeight: 600, color, textAlign: "right" }}>{value}</span>
              </div>
            ))}
          </div>
        </details>

        {/* Projection Receipt */}
        <div style={{ ...card, padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <ShieldCheck size={17} color={ACCENT} />
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Projection Receipt</h2>
            <span style={{ marginLeft: "auto", fontSize: 10, color: MUTED }}>
              {shownScenario.label} · {d!.resolution ?? "1.0 degree"} grid · {Math.round(year)}
            </span>
            <a href="/methodology" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: ACCENT, textDecoration: "none" }}>
              Methodology <ExternalLink size={11} />
            </a>
            <button onClick={copyRawForecastJson} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, border: `1px solid ${rawJsonCopied ? GREEN : BORDER}`, background: rawJsonCopied ? `${GREEN}18` : "rgba(255,255,255,0.025)", color: rawJsonCopied ? GREEN : "white", fontSize: 10, cursor: "pointer" }}>
              {rawJsonCopied ? <Check size={11} /> : <ShieldCheck size={11} />} {rawJsonCopied ? "Copied JSON" : "Copy raw JSON"}
            </button>
            <button onClick={downloadRawForecastJson} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, border: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.025)", color: "white", fontSize: 10, cursor: "pointer" }}>
              <Download size={11} /> Download JSON
            </button>
            <button onClick={downloadEducationalReport} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, border: `1px solid ${reportSaved ? GREEN : BORDER}`, background: reportSaved ? `${GREEN}18` : "rgba(255,255,255,0.025)", color: reportSaved ? GREEN : "white", fontSize: 10, cursor: "pointer" }}>
              {reportSaved ? <Check size={11} /> : <Download size={11} />} {reportSaved ? "Saved report" : "Download report"}
            </button>
          </div>
          <details>
            <summary style={{ cursor: "pointer", listStyle: "none", fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Full receipt — every range, baseline & source ▾</summary>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10, marginBottom: 12 }}>
            {[
              {
                label: "Temperature range",
                value: d!.tempLow != null && d!.tempHigh != null ? `${d!.tempLow.toFixed(1)}–${d!.tempHigh.toFixed(1)}°C` : "—",
                sub: d!.tempSpread != null ? `raw CMIP6 ±${d!.tempSpread.toFixed(1)}°C ensemble spread` : "spread unavailable",
                color: RED,
              },
              {
                label: "IPCC assessed temp",
                value: `${d!.ipccTemp.toFixed(1)}°C`,
                sub: `anomaly ${d!.ipccDelta >= 0 ? "+" : ""}${d!.ipccDelta.toFixed(1)}°C; adjustment ${d!.ipccAdjustment >= 0 ? "+" : ""}${d!.ipccAdjustment.toFixed(1)}°C; k=${d!.calibrationFactor.toFixed(2)}`,
                color: AMBER,
              },
              {
                label: "Precipitation range",
                value: d!.precipLow != null && d!.precipHigh != null ? `${Math.round(d!.precipLow)}–${Math.round(d!.precipHigh)}mm` : "—",
                sub: d!.precipSpreadPct != null ? `±${d!.precipSpreadPct.toFixed(1)}% model spread` : "spread unavailable",
                color: BLUE,
              },
              {
                label: "Sea-level range",
                value: d!.seaLow != null && d!.seaHigh != null ? `${Math.round(d!.seaLow)}–${Math.round(d!.seaHigh)}cm` : "—",
                sub: coastalRelevance?.isLocallyRelevant
                  ? "IPCC AR6 low to high; coastal screen, not parcel exposure"
                  : "IPCC AR6 low to high; regional context, not parcel exposure",
                color: CYAN,
              },
              {
                label: "Baseline",
                value: d!.baselineSource?.observed_resolution ?? "1.0 degree",
                sub: d!.baselineSource?.temperature ?? d!.baseline ?? "CMIP6 historical monthly climatology",
                color: GREEN,
              },
              {
                label: "Year basis",
                value:
                  d!.projectionYearBasis?.source_year_low != null && d!.projectionYearBasis?.source_year_high != null
                    ? d!.projectionYearBasis.source_year_low === d!.projectionYearBasis.source_year_high
                      ? `${d!.projectionYearBasis.source_year_low}`
                      : `${d!.projectionYearBasis.source_year_low}-${d!.projectionYearBasis.source_year_high}`
                    : "—",
                sub: d!.projectionYearBasis?.note ?? "Source cadence unavailable",
                color: PURPLE,
              },
            ].map((item) => (
              <div key={item.label} style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 11px" }}>
                <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: item.color, marginTop: 5 }}>{item.value}</div>
                <div style={{ fontSize: 9.5, color: MUTED, lineHeight: 1.35, marginTop: 4 }}>{item.sub}</div>
              </div>
            ))}
          </div>
          {d!.baselineSource?.delta_reference_period && (
            <p style={{ color: MUTED, fontSize: 9.5, lineHeight: 1.45, marginTop: 10 }}>
              Baseline note: {d!.baselineSource.delta_reference_period}.
            </p>
          )}
          <p style={{ color: MUTED, fontSize: 9.5, lineHeight: 1.45, marginTop: 8, marginBottom: 12 }}>
            Raw JSON export includes the selected-year projection, the full annual trajectory, scenario, model version, uncertainty fields, and source trail returned by the grounded API. The Markdown report is an educational summary built from the same visible fields, annual roadmap, climate twin, source trail, and missing-domain caveats.
          </p>
          <div style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${AMBER}38`, background: `${AMBER}10`, marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: AMBER, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 800, marginBottom: 5 }}>What this does not mean</div>
            <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55, color: "rgba(255,255,255,0.76)" }}>
              This is educational and research context, not a property-risk certificate, safety forecast, relocation recommendation, insurance model, medical advice, engineering assessment, or guarantee that this exact point will be livable or unlivable. Local adaptation, governance, health systems, wealth, migration, conflict, infrastructure, elevation, and parcel-scale exposure are outside this score.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
            {d!.sourceTrail.slice(0, 4).map((entry) => (
              <div key={entry.label} style={{ padding: "9px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.055)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "white" }}>{entry.label}</span>
                  <span style={{ fontSize: 9, color: ACCENT, textAlign: "right" }}>{entry.source}</span>
                </div>
                <div style={{ fontSize: 9.5, color: MUTED, lineHeight: 1.35 }}>{entry.method}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.42)", marginTop: 4 }}>{entry.citation}</div>
              </div>
            ))}
          </div>
          </details>
        </div>

        {/* Tipping Points */}
        <details style={{ ...card, padding: 18, marginBottom: 14 }}>
          <summary style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer", listStyle: "none" }}>
            <span style={{ fontSize: 18 }}>⏱️</span>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 600, margin: 0 }}>Tipping Point Timeline</h2>
            <span style={{ marginLeft: "auto", fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>expand ▾</span>
          </summary>
          <div style={{ height: 4, background: BORDER, borderRadius: 2, marginBottom: 16, position: "relative" }}>
            <div style={{ height: "100%", borderRadius: 2, background: `linear-gradient(to right, ${GREEN}, ${AMBER}, ${RED})`, width: `${tPct}%`, transition: "width 0.25s ease" }} />
            <div style={{ position: "absolute", top: "50%", left: `${tPct}%`, transform: "translate(-50%,-50%)", width: 10, height: 10, borderRadius: "50%", background: ACCENT, border: "2px solid white", transition: "left 0.25s ease" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {tipping.map((tp) => {
              const reached = tp.year != null;
              const passed = reached && year >= tp.year!;
              const isNext = reached && !passed && tipping.filter((x) => x.year != null && year < x.year!)[0]?.year === tp.year;
              return (
                <div key={tp.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, background: passed ? "rgba(239,68,68,0.07)" : isNext ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${passed ? "rgba(239,68,68,0.22)" : isNext ? "rgba(245,158,11,0.22)" : BORDER}`, transition: "all 0.25s ease" }}>
                  <span style={{ fontSize: 16 }}>{tp.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: passed ? RED : isNext ? AMBER : MUTED }}>{tp.label}</div>
                    <div style={{ fontSize: 9, color: MUTED, marginTop: 1 }}>{reached ? `${tp.year} · ${tp.year! - BASELINE_YEAR} years from baseline` : "Not reached by 2100"}</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: passed ? RED : MUTED }}>{reached ? tp.year : "—"}</div>
                  {passed && <span style={{ fontSize: 9, padding: "2px 6px", background: "rgba(239,68,68,0.18)", color: RED, borderRadius: 4, fontWeight: 700 }}>CROSSED</span>}
                  {isNext && <span style={{ fontSize: 9, padding: "2px 6px", background: "rgba(245,158,11,0.18)", color: AMBER, borderRadius: 4, fontWeight: 700 }}>NEXT</span>}
                  {!passed && !isNext && reached && <span style={{ fontSize: 9, padding: "2px 6px", background: BORDER, color: MUTED, borderRadius: 4 }}>FUTURE</span>}
                  {!reached && <span style={{ fontSize: 9, padding: "2px 6px", background: `${GREEN}18`, color: GREEN, borderRadius: 4, fontWeight: 700 }}>STABLE</span>}
                </div>
              );
            })}
          </div>
        </details>

        {/* Habitability Assessment */}
        <div style={{ ...card, padding: 18, marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Habitability Assessment</h2>
          <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 110 }}>
              <div style={{ position: "relative", width: 100, height: 100 }}>
                <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={sc} strokeWidth="3" strokeDasharray={`${d!.score}, 100`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.25s ease" }} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: sc }}>{d!.score}</span>
                  <span style={{ fontSize: 10, color: MUTED }}>/100</span>
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: sc }}>{d!.category}</span>
              <ScoreSparkline years={traj!.years} data={traj!.score} color={sc} year={year} />
              <div style={{ fontSize: 8, color: MUTED }}>{BASELINE_YEAR} baseline to {MAX_YEAR} trajectory</div>
            </div>
            {d!.breakdown.length > 0 && (
              <div style={{ flex: 1, minWidth: 280 }}>
                {/* Diverging axis legend: penalties grow left, contributions grow right */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 175, flexShrink: 0 }} />
                  <div style={{ flex: 1, position: "relative", height: 11 }}>
                    <span style={{ position: "absolute", left: 0, fontSize: 9, color: MUTED }}>− penalty</span>
                    <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontSize: 9, color: MUTED }}>0</span>
                    <span style={{ position: "absolute", right: 0, fontSize: 9, color: MUTED }}>+ contribution</span>
                  </div>
                  <div style={{ width: 40, flexShrink: 0 }} />
                </div>
                {d!.breakdown.map((item) => {
                  const half = Math.min((Math.abs(item.val) / maxBreakdown) * 50, 50);
                  return (
                    <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                      <div style={{ fontSize: 11, width: 175, color: MUTED, flexShrink: 0 }}>{item.label}</div>
                      <div style={{ flex: 1, position: "relative", height: 10, background: "rgba(255,255,255,0.04)", borderRadius: 3 }}>
                        <div style={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: 1, background: "rgba(255,255,255,0.22)" }} />
                        <div style={{ position: "absolute", top: 0, bottom: 0, width: `${half}%`, left: item.neg ? undefined : "50%", right: item.neg ? "50%" : undefined, background: item.neg ? RED : GREEN, borderRadius: item.neg ? "3px 0 0 3px" : "0 3px 3px 0", transition: "width 0.25s ease, left 0.25s ease, right 0.25s ease" }} />
                      </div>
                      <div style={{ fontSize: 11, fontFamily: "monospace", color: item.neg ? RED : GREEN, width: 40, textAlign: "right" }}>
                        {item.neg ? "−" : "+"}{Math.abs(item.val).toFixed(1)}
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 13, fontWeight: 700, color: sc }}>
                  Total: {d!.score}
                </div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[{ r: "0–39", l: "Severe", c: RED }, { r: "40–59", l: "Poor", c: ORANGE }, { r: "60–69", l: "Fair", c: AMBER }, { r: "70–84", l: "Good", c: GREEN }, { r: "85–100", l: "Excellent", c: "#4ade80" }].map((b) => {
              const active = b.l === d!.category;
              return <div key={b.r} style={{ padding: "3px 10px", borderRadius: 10, fontSize: 10, background: active ? `${b.c}18` : "rgba(255,255,255,0.04)", color: active ? b.c : MUTED, fontWeight: active ? 700 : 400, border: active ? `1px solid ${b.c}35` : "none" }}>{b.l} ({b.r})</div>;
            })}
          </div>
        </div>
    </>
  );
}
