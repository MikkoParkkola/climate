import { GitCompare, Loader2, Download, Search, MapPin, ArrowLeft, Play, Pause, ShieldCheck, ExternalLink, Share2, Check, Atom } from "lucide-react";
import GuidedClimateExplainer from "@/components/guided-climate-explainer";
import ScenarioSmallMultiples, { type ScenarioSmallMultipleMetric } from "@/components/scenario-small-multiples";
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
  ReceiptDetails, ChartValuesDetails, TrendChart, MonthlyTempChart, PrecipBars,
} from "@/components/climate-charts";

import type { ClimateAppVM } from "@/hooks/use-climate-app";
import { Term, MetricTip } from "@/components/climate-term";
import type { GlossaryKey } from "@/lib/glossary";


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
  dailyLifeSignals, tipping, selectedScenario, shownScenario,
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
        {/* Atmospheric Physics */}
        <details style={{ ...card, padding: 18, marginBottom: 14 }}>
          <summary style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", listStyle: "none" }}>
            <span style={{ fontSize: 18, display: "inline-flex" }}><Atom style={{ width: 18, height: 18 }} /></span>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 600, margin: 0 }}>Atmospheric Physics</h3>
            <span style={{ marginLeft: "auto", fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>expand ▾</span>
          </summary>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "2px 18px", marginTop: 12 }}>
            {[
              { label: "Circulation Pattern", termKey: "circulation" as GlossaryKey | undefined, value: d!.circulation ?? "—", color: BLUE },
              { label: "Climate Sensitivity", termKey: "climate_sensitivity" as GlossaryKey | undefined, value: d!.sensitivity != null ? `${d!.sensitivity.toFixed(1)}°C per CO₂ doubling` : "—", color: ORANGE },
              { label: "Active Feedbacks", termKey: undefined as GlossaryKey | undefined, value: d!.feedbacks.length ? d!.feedbacks.map((f) => f.split(":")[0].trim()).join(" · ") : "—", color: PURPLE },
              { label: "Model Confidence", termKey: "confidence" as GlossaryKey | undefined, value: prettify(d!.confidence), color: confidenceColor(d!.confidence) },
              { label: "Model", termKey: "cmip6" as GlossaryKey | undefined, value: d!.modelVersion ? `${d!.model} ${d!.modelVersion}` : d!.model, color: MUTED },
              { label: "Resolution", termKey: "resolution" as GlossaryKey | undefined, value: d!.resolution ?? "—", color: MUTED },
            ].map(({ label, termKey, value, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 6, marginBottom: 6, fontSize: 11 }}>
                <span style={{ color: MUTED, flexShrink: 0 }}>{termKey ? <Term k={termKey}>{label}</Term> : label}</span>
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

        <div style={{ height: 1, background: BORDER, margin: "28px 0 18px" }} />
        {shareStory && (
          <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${ACCENT}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ minWidth: 0, flex: "1 1 420px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <Share2 style={{ width: 15, height: 15, color: ACCENT }} />
                  <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Shareable climate story</h2>
                  <ReceiptDetails label="receipt" text={shareStory.caveat} />
                </div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, lineHeight: 1.45, color: "white" }}>{shareStory.headline}</p>
                <p style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.6, color: "rgba(255,255,255,0.76)" }}>
                  {shareStory.metricLine}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button onClick={shareForecast} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 7, border: `1px solid ${ACCENT}55`, background: `${ACCENT}18`, color: "white", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                  <Share2 style={{ width: 13, height: 13 }} />
                  Share story
                </button>
                <button onClick={copyShareStory} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 7, border: `1px solid ${shareStoryCopied ? GREEN : BORDER}`, background: shareStoryCopied ? `${GREEN}18` : "rgba(255,255,255,0.035)", color: shareStoryCopied ? GREEN : "white", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                  {shareStoryCopied ? <Check style={{ width: 13, height: 13 }} /> : <Share2 style={{ width: 13, height: 13 }} />}
                  {shareStoryCopied ? "Copied story" : "Copy story"}
                </button>
                <button onClick={downloadShareImage} disabled={shareImageBusy} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 7, border: `1px solid ${shareImageSaved ? GREEN : BORDER}`, background: shareImageSaved ? `${GREEN}18` : "rgba(255,255,255,0.035)", color: shareImageSaved ? GREEN : "white", fontSize: 12, fontWeight: 800, cursor: shareImageBusy ? "wait" : "pointer", opacity: shareImageBusy ? 0.72 : 1 }}>
                  {shareImageBusy ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> : shareImageSaved ? <Check style={{ width: 13, height: 13 }} /> : <Download style={{ width: 13, height: 13 }} />}
                  {shareImageBusy ? "Rendering image" : shareImageSaved ? "Saved image" : "Download image"}
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 9 }}>
              {[
                { label: "Trend driver", text: shareStory.driverLine, color: AMBER },
                { label: "Climate twin", text: shareStory.analogLine, color: PURPLE },
              ].map((item) => (
                <div key={item.label} style={{ background: "rgba(255,255,255,0.035)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 10, color: item.color, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 800, marginBottom: 5 }}>{item.label}</div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "rgba(255,255,255,0.82)" }}>{item.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

    </>
  );
}
