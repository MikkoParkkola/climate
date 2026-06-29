import { useState } from "react";
import { GitCompare, Loader2, Download, Search, MapPin, ArrowLeft, Play, Pause, ShieldCheck, ExternalLink, Share2, Check, SlidersHorizontal } from "lucide-react";
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
import ClimateResultSectionsTop from "@/components/climate-result-sections-top";
import ClimateResultSectionsBottom from "@/components/climate-result-sections-bottom";
import { LivabilityRunway } from "@/components/livability-runway";
import { YourConditionsDrawer } from "@/components/your-conditions-drawer";
import { SharedLensBanner } from "@/components/shared-lens-banner";

export default function ClimateResultView({ vm }: { vm: ClimateAppVM }) {
  const {
  locationText, setLocationText, selectedLocation, setSelectedLocation,
  suggestions, showSuggestions, setShowSuggestions, year, scenario, trajectory,
  isLoading, loadingStep, error, exporting, playing, shareCopied, shareStoryCopied,
  shareImageBusy, shareImageSaved, rawJsonCopied, reportSaved, analogCatalog, analogError,
  coastalArtifact, coastalArtifactError, scenarioContrast, scenarioContrastLoading,
  scenarioContrastError, resultsRef, birthYear, scoredTrajectory, standardSnapshot,
  traj, d, displayYear, climateAnalog, coastalRelevance, scenarioContrastRows,
  scenarioSmallMultipleMetrics, scenarioContrastTakeaway, roadmapItems, scoreStory,
  scoreSensitivityInputs, dailyLifeSignals, tipping, selectedScenario, shownScenario,
  shareUrl, shareStory, learningPrompts, sc, tPct, maxBreakdown,
  togglePlay, setYearManual, selectLocation, generate, loadScenarioContrast, changeScenario,
  newSearch, exportPDF, openClimateTwinCity, copyShareStory, downloadShareImage, shareForecast,
  buildRawForecastJson, copyRawForecastJson, downloadRawForecastJson,
  buildEducationalReportMarkdown, downloadEducationalReport,
  } = vm;

  const [conditionsOpen, setConditionsOpen] = useState(false);

  // ── Results ──────────────────────────────────────────────────────────────
  // Plain-language outlook, derived live from the real modeled values.
  const placeName = selectedLocation?.name?.split(",")[0] ?? "This location";
  const heatDelta = d!.heatDays - d!.baseHeatDays;
  const nextTip = tipping.find((t) => t.year != null && (t.year as number) > displayYear);
  const crossedTips = tipping.filter((t) => t.year != null && (t.year as number) <= displayYear).length;

  return (
    <div style={{ backgroundColor: BG, color: "white", minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Sticky Header */}
      <header style={{ background: "hsl(222,16%,9%)", borderBottom: `1px solid ${BORDER}`, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px", height: 48, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/favicon.svg" alt="" width={28} height={28} style={{ width: 28, height: 28, borderRadius: 6, display: "block" }} />
            <span style={{ fontWeight: 700, fontSize: 16 }}>fupit</span>
            <div style={{ width: 1, height: 14, background: BORDER }} />
            <span style={{ fontSize: 13 }}>{selectedLocation?.name}</span>
            <span style={{ fontSize: 13, color: MUTED }}>·</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>{displayYear}</span>
            <span style={{ fontSize: 13, color: MUTED }}>·</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: RED }}>{shownScenario.label}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              value={scenario}
              onChange={(e) => changeScenario(parseScenario(e.target.value))}
              disabled={isLoading}
              title="Climate scenario"
              aria-label="Climate scenario"
              style={{ height: 29, borderRadius: 6, border: `1px solid ${BORDER}`, background: CARD, color: "white", fontSize: 12, fontWeight: 700, padding: "0 8px", cursor: isLoading ? "wait" : "pointer" }}
            >
              {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            {scenario === DEFAULT_SCENARIO && (
              <ReceiptDetails label="default" text={`${DEFAULT_SCENARIO_EXPLANATION} Version: ${DEFAULT_SCENARIO_POLICY_VERSION}.`} />
            )}
            <button onClick={() => setConditionsOpen(true)} title="Tune the score to your ideal conditions" style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: `1px solid ${BORDER}`, background: CARD, color: "white", fontSize: 12, cursor: "pointer" }}>
              <SlidersHorizontal style={{ width: 13, height: 13 }} /> Conditions
            </button>
            <button onClick={newSearch} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: `1px solid ${BORDER}`, background: CARD, color: MUTED, fontSize: 12, cursor: "pointer" }}>
              <ArrowLeft style={{ width: 13, height: 13 }} /> New Search
            </button>
            <button onClick={() => (window.location.href = "/comparison")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: `1px solid ${BORDER}`, background: CARD, color: "white", fontSize: 12, cursor: "pointer" }}>
              <GitCompare style={{ width: 13, height: 13 }} /> Compare
            </button>
            <button onClick={shareForecast} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: `1px solid ${shareCopied ? GREEN : BORDER}`, background: shareCopied ? `${GREEN}18` : CARD, color: shareCopied ? GREEN : "white", fontSize: 12, cursor: "pointer" }}>
              {shareCopied ? <Check style={{ width: 13, height: 13 }} /> : <Share2 style={{ width: 13, height: 13 }} />} {shareCopied ? "Copied" : "Share"}
            </button>
            <button onClick={exportPDF} disabled={exporting} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: `1px solid ${BORDER}`, background: CARD, color: "white", fontSize: 12, cursor: exporting ? "wait" : "pointer" }}>
              {exporting ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> : <Download style={{ width: 13, height: 13 }} />} Export PDF
            </button>
          </div>
        </div>
      </header>

      {/* Year Slider — sticky */}
      <div style={{ position: "sticky", top: 48, zIndex: 45, background: "hsl(222,16%,8.5%)", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 20px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={togglePlay} title={playing ? "Pause" : `Play ${CURRENT_FORECAST_YEAR} to ${MAX_YEAR}`} aria-label={playing ? "Pause timeline" : "Play timeline"}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: "50%", flexShrink: 0, cursor: "pointer", color: playing ? ACCENT : "white", border: `1px solid ${playing ? ACCENT : "rgba(255,255,255,0.18)"}`, background: playing ? `${ACCENT}22` : CARD, transition: "all 0.2s ease" }}>
              {playing ? <Pause style={{ width: 15, height: 15 }} /> : <Play style={{ width: 15, height: 15, marginLeft: 1 }} />}
            </button>
            <div style={{ display: "flex", gap: 4 }}>
              {QUICK_YEAR_BUTTONS.map((y) => (
                <button key={y} onClick={() => setYearManual(y)}
                  style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${displayYear === y ? ACCENT : "rgba(255,255,255,0.12)"}`, background: displayYear === y ? `${ACCENT}18` : "transparent", color: displayYear === y ? ACCENT : MUTED, fontSize: 11, fontWeight: displayYear === y ? 700 : 400, cursor: "pointer" }}>
                  {y}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", top: 8, left: 0, right: 0, height: 4, borderRadius: 2, pointerEvents: "none", background: `linear-gradient(to right, ${GREEN} 0%, ${AMBER} 40%, ${ORANGE} 65%, ${RED} 100%)`, opacity: 0.3 }} />
                <input type="range" min={BASELINE_YEAR} max={MAX_YEAR} step={0.1} value={year}
                  onChange={(e) => setYearManual(Number(e.target.value))}
                  style={{ width: "100%", cursor: "pointer", accentColor: ACCENT, position: "relative", zIndex: 1, margin: 0, display: "block" }} />
              </div>
              <div style={{ position: "relative", height: 16, marginTop: 1 }}>
                {YEAR_TICKS.map((y) => {
                  // Position each tick by its true year fraction so it lines up with the
                  // linear slider thumb. The +(0.5-frac)*THUMB term corrects for the native
                  // range thumb inset (its center travels ~half a thumb-width in from each edge).
                  const frac = (y - BASELINE_YEAR) / (MAX_YEAR - BASELINE_YEAR);
                  const THUMB = 16;
                  const major = y % 25 === 0;
                  return (
                    <div key={y} style={{ position: "absolute", top: 0, left: `calc(${frac * 100}% + ${(0.5 - frac) * THUMB}px)`, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                      <div style={{ width: 1, height: major ? 6 : 3, background: major ? MUTED : "rgba(255,255,255,0.18)" }} />
                      {(y === CURRENT_FORECAST_YEAR || major) && <span style={{ fontSize: 8, color: MUTED, whiteSpace: "nowrap" }}>{y}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              {[
                { v: displayYear.toString(), sub: "year", c: ACCENT },
                { v: d!.score.toString(), sub: "score", c: sc },
                { v: `+${d!.tempChange.toFixed(1)}°`, sub: "warming", c: RED },
              ].map(({ v, sub, c }) => (
                <div key={sub} style={{ ...card, padding: "4px 11px", textAlign: "center", minWidth: 52 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: c, lineHeight: 1 }}>{v}</div>
                  <div style={{ fontSize: 8, color: MUTED, marginTop: 1 }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <main ref={resultsRef} style={{ maxWidth: 1200, margin: "0 auto", padding: "18px 20px" }}>
        {trajectory && selectedLocation && (
          <div style={{ marginBottom: 18 }}>
            <SharedLensBanner standardScore={standardSnapshot?.score ?? null} personalScore={d?.score ?? null} />
            <LivabilityRunway
              points={scoredTrajectory ?? trajectory}
              locationName={selectedLocation.name}
              birthYear={birthYear ?? undefined}
              scenarioLabel={shownScenario.label}
              scenarios={scenarioContrast}
              onLoadScenarios={loadScenarioContrast}
              scenariosLoading={scenarioContrastLoading}
            />
          </div>
        )}
        <ClimateResultSectionsTop vm={vm} />
        <ClimateResultSectionsBottom vm={vm} />
      </main>

      {/* Activism Section */}
      <section style={{ background: "rgba(255,255,255,0.015)", borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: "56px 20px", textAlign: "center" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16, letterSpacing: "-0.01em" }}>A forecast isn't a fate.</h2>
          <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.75, marginBottom: 28 }}>
            Use the scenario contrast as a learning tool: lower-warming pathways change the local roadmap, and higher-warming pathways show what gets harder. The point is to make those differences visible, not to treat any one pathway as fate.
          </p>
          <p style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.3, marginBottom: 16, letterSpacing: "-0.02em" }}>
            Don't just find a better spot. F*** up the forecast.
          </p>
          <p style={{ fontSize: 12, color: MUTED, letterSpacing: "0.03em" }}>→ fupit.com</p>
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: "16px 20px", textAlign: "center" }}>
        <p style={{ color: MUTED, fontSize: 10 }}>
          fupit · {d!.model}{d!.modelVersion ? ` ${d!.modelVersion}` : ""} · {shownScenario.label} · Uncertainty shown from ensemble spread / AR6 ranges · For research &amp; planning
        </p>
        <p style={{ color: MUTED, fontSize: 10, marginTop: 6 }}>
          © {new Date().getFullYear()}{" "}
          <a href="https://github.com/MikkoParkkola" target="_blank" rel="noopener noreferrer" style={{ color: MUTED, textDecoration: "underline", textUnderlineOffset: 2 }}>
            Mikko Parkkola
          </a>
        </p>
      </footer>
      <YourConditionsDrawer open={conditionsOpen} onClose={() => setConditionsOpen(false)} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
