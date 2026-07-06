import { GitCompare, Loader2, Download, Search, MapPin, ArrowLeft, Play, Pause, ShieldCheck, ExternalLink, Share2, Check, Wind, ClipboardList, TrendingUp, Lightbulb, Waves, AlertTriangle, Timer } from "lucide-react";
import GuidedClimateExplainer from "@/components/guided-climate-explainer";
import { LocalChanges } from "@/components/local-changes";
import { MitigationCard } from "@/components/mitigation-card";
import { TwinArc } from "@/components/twin-arc";
import { LivabilityBar } from "@/components/livability-bar";
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
  ReceiptDetails, ChartValuesDetails, TrendChart, MonthlyTempChart, PrecipBars, ScoreSparkline,
} from "@/components/climate-charts";

import type { ClimateAppVM } from "@/hooks/use-climate-app";
import type { FreshwaterStress, FireWeather, FloodExposure, CropYield } from "@/lib/climate-types";
import { EnrichmentEmptyState, SubstitutionNote } from "@/components/enrichment-coverage";
import { Term, MetricTip } from "@/components/climate-term";

// Aqueduct water-stress category (-1 arid .. 4 extremely high) -> theme colour.
function freshwaterCategoryColor(category: number | null): string {
  switch (category) {
    case 0: return GREEN;
    case 1: return AMBER;
    case 2: return ORANGE;
    case 3: return RED;
    case 4: return RED;
    case -1: return CYAN;
    default: return MUTED;
  }
}


export default function ClimateResultSectionsTop({ vm }: { vm: ClimateAppVM }) {
  const {
  locationText, setLocationText, selectedLocation, setSelectedLocation,
  suggestions, showSuggestions, setShowSuggestions, year, scenario, trajectory, freshwater, fireWeather, floodRiver, cropYield, coverage, amoc, humidHeat, coldSeason, degreeDays,
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
  // Resolve each enrichment's coverage from the top-level coverage map (exact
  // keys: freshwater / fireWeather / floodRiver / cropYield), falling back to a
  // status carried on the enrichment object. Optional-chaining throughout.
  const fwCoverage = coverage?.freshwater ?? freshwater?.coverageStatus ?? null;
  const fireCoverage = coverage?.fireWeather ?? fireWeather?.coverageStatus ?? null;
  const floodCoverage = coverage?.floodRiver ?? floodRiver?.coverageStatus ?? null;
  const cropCoverage = coverage?.cropYield ?? cropYield?.coverageStatus ?? null;
  // When a scenario has no served value but the backend offers the nearest
  // pathway's full enrichment object, render that as a clearly-labeled
  // substitute. "shown" is the object each section actually renders.
  const fwShown = freshwater ?? (fwCoverage?.nearestScenario?.value as FreshwaterStress | null | undefined) ?? null;
  const fireShown = fireWeather ?? (fireCoverage?.nearestScenario?.value as FireWeather | null | undefined) ?? null;
  const floodShown = floodRiver ?? (floodCoverage?.nearestScenario?.value as FloodExposure | null | undefined) ?? null;
  const cropShown = cropYield ?? (cropCoverage?.nearestScenario?.value as CropYield | null | undefined) ?? null;
  const fwIsSub = !freshwater && !!fwShown;
  const fireIsSub = !fireWeather && !!fireShown;
  const floodIsSub = !floodRiver && !!floodShown;
  const cropIsSub = !cropYield && !!cropShown;
  // Active horizon nearest the displayed year, computed from the shown object
  // (Aqueduct / Quilcaille horizons are 2030/2050/2080).
  const fwActive = fwShown
    ? fwShown.horizons.reduce((best, h) => (Math.abs(h.year - displayYear) < Math.abs(best.year - displayYear) ? h : best))
    : null;
  const fireActive = fireShown
    ? fireShown.horizons.reduce((best, h) => (Math.abs(h.year - displayYear) < Math.abs(best.year - displayYear) ? h : best))
    : null;
  const floodActive = floodShown
    ? floodShown.horizons.reduce((best, h) => (Math.abs(h.year - displayYear) < Math.abs(best.year - displayYear) ? h : best))
    : null;
  // NEX-GDDP horizons nearest the displayed year (windows are 2030/2050/2080; year is numeric there).
  const nearestNex = <T extends { year: number | null }>(hs: T[]): T | null =>
    hs.length ? hs.reduce((best, h) => (Math.abs((h.year ?? displayYear) - displayYear) < Math.abs((best.year ?? displayYear) - displayYear) ? h : best)) : null;
  const humidActive = humidHeat ? nearestNex(humidHeat.horizons) : null;
  const coldActive = coldSeason ? nearestNex(coldSeason.horizons) : null;
  const ddActive = degreeDays ? nearestNex(degreeDays.horizons) : null;

  return (
    <>
        {/* Location Banner */}
        <div style={{ ...card, padding: 18, marginBottom: 14, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px,rgba(255,255,255,0.03) 1px,transparent 0)", backgroundSize: "24px 24px", pointerEvents: "none" }} />
          <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 600, lineHeight: 1, marginBottom: 8, letterSpacing: "-0.015em" }}>{selectedLocation?.name}</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: MUTED, flexWrap: "wrap" }}>
                <span>{Math.abs(selectedLocation!.lat).toFixed(4)}° {selectedLocation!.lat >= 0 ? "N" : "S"}, {Math.abs(selectedLocation!.lng).toFixed(4)}° {selectedLocation!.lng >= 0 ? "E" : "W"}</span>
                {d!.climateZone && <><span>·</span><span style={{ background: "rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 10, fontSize: 11 }}>{d!.climateZone}</span></>}
                {d!.sensLabel && <><span>·</span><span>Sensitivity: <span style={{ color: d!.sensColor, fontWeight: 600 }}>{d!.sensLabel}</span></span></>}
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {d!.circulation && (
                  <span style={{ background: `${BLUE}14`, border: `1px solid ${BLUE}28`, color: BLUE, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4 }}><Wind style={{ width: 12, height: 12 }} /> {d!.circulation.split(/[-–(]/)[0].trim()}</span>
                )}
                {d!.feedbacks.slice(0, 3).map((f, i) => {
                  const t = feedbackTag(f);
                  return <span key={i} style={{ background: `${t.color}14`, border: `1px solid ${t.color}28`, color: t.color, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 500 }}>{t.icon} {t.label}</span>;
                })}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", marginBottom: 4 }}>Raw model consensus</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: RED }}>{shownScenario.label}</div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{shownScenario.caption}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: RED, marginTop: 2 }}>+{d!.tempChange.toFixed(1)}°C</div>
              <div style={{ fontSize: 11, color: MUTED }}>vs baseline · IPCC assessed {d!.ipccDelta >= 0 ? "+" : ""}{d!.ipccDelta.toFixed(1)}°C</div>
            </div>
          </div>
        </div>

        {/* Climate Outlook — plain-language summary (updates live with the slider) */}
        <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${ACCENT}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
            <span style={{ fontSize: 15, display: "inline-flex", color: MUTED }}><ClipboardList style={{ width: 15, height: 15 }} /></span>
            <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Climate Outlook · {displayYear}</h2>
          </div>
          <p style={{ fontSize: 14.5, lineHeight: 1.75, color: "rgba(255,255,255,0.9)", margin: 0 }}>
            By <strong style={{ color: "white" }}>{displayYear}</strong>, {placeName}'s raw CMIP6 ensemble projection is{" "}
            <strong style={{ color: RED }}>+{d!.tempChange.toFixed(1)}°C warmer</strong> than its baseline; the IPCC-assessed calibrated anomaly is{" "}
            <strong style={{ color: AMBER }}>{d!.ipccDelta >= 0 ? "+" : ""}{d!.ipccDelta.toFixed(1)}°C</strong>. Heat-stress days{" "}
            <strong style={{ color: ORANGE }}>
              {heatDelta === 0 ? `hold steady at ${d!.heatDays}/yr` : `${heatDelta > 0 ? "rise" : "fall"} from ${d!.baseHeatDays} to ${d!.heatDays}/yr`}
            </strong>
            , annual rainfall shifts{" "}
            <strong style={{ color: BLUE }}>{d!.precipChange >= 0 ? "+" : ""}{d!.precipChange.toFixed(1)}%</strong>, and overall habitability sits at{" "}
            <strong style={{ color: sc }}>{d!.score}/100 ({d!.category})</strong>.
            {nextTip
              ? <> The next threshold ahead — <strong style={{ color: AMBER }}>{nextTip.label.toLowerCase()}</strong> — is crossed around <strong style={{ color: AMBER }}>{nextTip.year}</strong>.</>
              : crossedTips > 0
                ? <> All <strong style={{ color: RED }}>{crossedTips}</strong> modeled tipping points have already been crossed by this point.</>
              : <> No modeled tipping points are crossed at this horizon.</>}
          </p>
        </div>

        <LivabilityBar score={d!.score} baselineScore={scoreStory?.baselineScore} year={displayYear} />

        {climateAnalog && selectedLocation && (
          <TwinArc
            from={{ lat: selectedLocation.lat, lng: selectedLocation.lng, name: placeName }}
            to={{ lat: climateAnalog.candidate.lat, lng: climateAnalog.candidate.lng, name: climateAnalog.candidate.name }}
            matchLabel={climateAnalog.matchLabel}
            noAnalog={climateAnalog.noAnalog}
          />
        )}

        <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${PURPLE}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <MapPin style={{ width: 15, height: 15, color: PURPLE }} />
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Climate Twin · current-day analog</h2>
            </div>
            {analogCatalog && (
              <span style={{ fontSize: 10, color: MUTED }}>
                {analogCatalog.candidateCount} indexed cities · {analogCatalog.catalogYear} catalog
              </span>
            )}
          </div>

          {climateAnalog ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 360px" }}>
                  <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "rgba(255,255,255,0.9)", margin: 0 }}>
                    In <strong style={{ color: "white" }}>{displayYear}</strong>, {placeName}'s climate most resembles{" "}
                    <strong style={{ color: PURPLE }}>{climateAnalog.candidate.name}, {climateAnalog.candidate.country}</strong>{" "}
                    in the current-day catalog. This is a nearest match across monthly temperature and precipitation, not a claim that every local impact is identical.
                  </p>
                  <p style={{ fontSize: 11, color: MUTED, marginTop: 8, lineHeight: 1.55 }}>
                    Distance {climateAnalog.distance.toFixed(2)} standardized climate units; lower is closer. Compared {climateAnalog.comparedCount} cities from the grounded analog catalog.
                  </p>
                </div>
                <button
                  onClick={openClimateTwinCity}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 7, border: `1px solid ${PURPLE}55`, background: `${PURPLE}16`, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  <ExternalLink style={{ width: 13, height: 13 }} />
                  Open twin city
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))", gap: 8, marginTop: 14 }}>
                {[
                  { label: "Avg temp gap", value: `${signedNumber(climateAnalog.annualTempDelta, 1)}°C`, color: RED },
                  { label: "Rainfall gap", value: `${signedNumber(climateAnalog.annualPrecipDelta, 0)} mm`, color: BLUE },
                  { label: "Heat nights gap", value: `${signedNumber(climateAnalog.heatDaysDelta, 0)} d/yr`, color: ORANGE },
                  { label: "Drought gap", value: `${signedNumber(climateAnalog.droughtDelta, 0)} pts`, color: AMBER },
                  { label: "Flood gap", value: `${signedNumber(climateAnalog.floodDelta, 0)} pts`, color: CYAN },
                ].map((item) => (
                  <div key={item.label} style={{ background: "rgba(255,255,255,0.035)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10, minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: item.color, whiteSpace: "nowrap" }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, color: analogError ? "#fca5a5" : MUTED, fontSize: 13 }}>
              {analogError ?? "Loading grounded current-day analog catalog..."}
            </p>
          )}
        </div>

        {/* Metric Trajectories */}
        <div style={{ ...card, padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16, display: "inline-flex" }}><TrendingUp style={{ width: 16, height: 16 }} /></span>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Metric Trajectories</h2>
              <span style={{ fontSize: 10, color: MUTED, marginLeft: 4 }}>{BASELINE_YEAR} baseline to {MAX_YEAR}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: MUTED }}>
              <div style={{ width: 14, height: 1.5, borderTop: `1.5px dashed ${ACCENT}`, opacity: 0.7 }} />
              <span>= selected year marker (synced with slider above)</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 12 }}>
            <TrendChart
              years={traj!.years}
              values={traj!.temp}
              lowValues={traj!.tempLow}
              highValues={traj!.tempHigh}
              year={year}
              label="Temperature"
              unit="°C"
              color={RED}
              decimals={1}
              thresholdY={18}
              scenarioLabel={shownScenario.label}
              uncertaintyLabel="Shaded band uses temperature.uncertainty.annual_mean_low/high from the grounded API for this location, year range, and scenario."
            />
            <TrendChart
              years={traj!.years}
              values={traj!.precip}
              lowValues={traj!.precipLow}
              highValues={traj!.precipHigh}
              year={year}
              label="Precipitation"
              unit="mm"
              color={BLUE}
              decimals={0}
              scenarioLabel={shownScenario.label}
              uncertaintyLabel="Shaded band uses precipitation.uncertainty.annual_total_low/high from the grounded API. Local precipitation trends can have larger model disagreement and direction changes."
            />
            <TrendChart years={traj!.years} values={traj!.heat} year={year} label="Heat Days" unit="d" color={ORANGE} decimals={0} thresholdY={15} scenarioLabel={shownScenario.label} />
            <TrendChart years={traj!.years} values={traj!.score} year={year} label="Habitability" unit="" color={sc} decimals={0}
              scenarioLabel={shownScenario.label}
              zones={[
                { from: 85, to: 100, color: GREEN }, { from: 70, to: 85, color: "#4ade80" },
                { from: 60, to: 70, color: AMBER }, { from: 40, to: 60, color: ORANGE }, { from: 0, to: 40, color: RED },
              ]} />
            <TrendChart
              years={traj!.years}
              values={traj!.sea}
              lowValues={traj!.seaLow}
              highValues={traj!.seaHigh}
              year={year}
              label="Sea-level context"
              unit="cm"
              color={CYAN}
              decimals={0}
              thresholdY={50}
              thresholdLabel={coastalRelevance?.thresholdLabel ?? "50 cm regional context"}
              scenarioLabel={shownScenario.label}
              uncertaintyLabel={`Shaded band uses AR6 regional sea-level low/high context returned by the API. ${coastalRelevance?.receipt ?? "Coastal relevance is not evaluated, so this is not a parcel-level coastal exposure assessment."}`}
            />
            <TrendChart
              years={traj!.years}
              values={traj!.drought}
              year={year}
              label="Drought Risk"
              unit="%"
              color={AMBER}
              decimals={0}
              thresholdY={50}
              thresholdLabel="50% elevated risk"
              scenarioLabel={shownScenario.label}
            />
            <TrendChart
              years={traj!.years}
              values={traj!.flood}
              year={year}
              label="Flood Risk"
              unit="%"
              color={BLUE}
              decimals={0}
              thresholdY={50}
              thresholdLabel="50% elevated risk"
              scenarioLabel={shownScenario.label}
            />
          </div>
          <div style={{ marginTop: 12, padding: "6px 10px", background: `${ACCENT}07`, border: `1px solid ${ACCENT}18`, borderRadius: 8, fontSize: 10, color: MUTED }}>
            <Lightbulb style={{ width: 14, height: 14, display: "inline", verticalAlign: "-2px", marginRight: 4 }} /> Drag the year slider to move the marker across all seven charts simultaneously and see how each metric evolves. Hover plotted years for values, or open values for keyboard/touch access. Translucent bands show grounded low-high ranges where the API exposes comparable uncertainty fields; labeled dashed horizontal lines mark documented risk/context thresholds.
          </div>
        </div>

        {/* Tipping Points */}
        <div style={{ ...card, padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer", listStyle: "none" }}>
            <span style={{ fontSize: 18, display: "inline-flex" }}><Timer style={{ width: 18, height: 18 }} /></span>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 600, margin: 0 }}>Tipping Point Timeline</h2>
          </div>
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
        </div>

        <LocalChanges
          year={displayYear}
          d={{
            year: displayYear,
            tempChange: d!.tempChange,
            heatDays: d!.heatDays,
            baseHeatDays: d!.baseHeatDays,
            coldMonthCount: d!.coldMonthCount,
            baselineColdMonthCount: d!.baselineColdMonthCount,
            drought: d!.drought,
            flood: d!.flood,
            seaLevelRiseCm: d!.seaLevel,
            seaLevelApplicable: d!.seaLevelApplicable,
          }}
        />

        <MitigationCard tempChange={d!.tempChange} year={displayYear} />

        {scoreStory && (
          <div style={{ marginBottom: 14 }}>
            <GuidedClimateExplainer
              placeName={placeName}
              year={displayYear}
              scenarioLabel={shownScenario.label}
              scenarioCaption={shownScenario.caption}
              tempChange={d!.tempChange}
              ipccDelta={d!.ipccDelta}
              heatDays={d!.heatDays}
              heatDelta={heatDelta}
              precipChange={d!.precipChange}
              score={d!.score}
              category={d!.category}
              topDriver={scoreStory.scoreDrivers[0] ? {
                label: scoreStory.scoreDrivers[0].label,
                movement: scoreStory.scoreDrivers[0].movement,
                effect: scoreStory.scoreDrivers[0].effect,
              } : undefined}
              dailyLifeSignals={dailyLifeSignals}
              roadmapItems={roadmapItems}
              climateTwin={climateAnalog ? {
                name: climateAnalog.candidate.name,
                country: climateAnalog.candidate.country,
                distance: climateAnalog.distance,
                comparedCount: climateAnalog.comparedCount,
                matchLabel: climateAnalog.matchLabel,
                sigma: climateAnalog.sigma,
                noAnalog: climateAnalog.noAnalog,
                annualTempDelta: climateAnalog.annualTempDelta,
                annualPrecipDelta: climateAnalog.annualPrecipDelta,
                heatDaysDelta: climateAnalog.heatDaysDelta,
              } : null}
              scenarioContrastText={scenarioContrastTakeaway?.text ?? null}
              hasScenarioContrast={scenarioContrastRows.length > 0}
              sourceCount={d!.sourceTrail.length}
            />
          </div>
        )}

        {roadmapItems.length > 0 && (
          <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${PURPLE}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ flex: "1 1 460px" }}>
                <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Roadmap · current year to 2100</h2>
                <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.68)", lineHeight: 1.6, margin: "6px 0 0" }}>
                  The slider gives a value for every year. This roadmap summarizes the current year and decade waypoints so the trend reads like a living-conditions timeline, not a single snapshot.
                </p>
              </div>
              <ReceiptDetails label="method" text="Roadmap values use the same /api/climate-trajectory points as the charts. The current build requests the current year plus 5-year checkpoints through 2100 and linearly interpolates intermediate years for display." />
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {roadmapItems.map((item) => {
                const active = item.year === displayYear || (displayYear > item.year && displayYear < item.year + 10);
                return (
                  <div key={item.year} style={{ display: "flex", gap: 10, alignItems: "stretch", flexWrap: "wrap", padding: "9px 10px", borderRadius: 8, border: `1px solid ${active ? `${PURPLE}55` : BORDER}`, background: active ? `${PURPLE}10` : "rgba(255,255,255,0.032)" }}>
                    <div style={{ flex: "0 0 56px" }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: active ? PURPLE : "white" }}>{item.year}</div>
                      <div style={{ fontSize: 9, color: MUTED }}>{item.category}</div>
                    </div>
                    <div style={{ minWidth: 180, flex: "2 1 260px" }}>
                      <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", marginBottom: 3 }}>
                        <span style={{ color: item.driver.color, fontSize: 12, fontWeight: 850 }}>{item.driver.label}</span>
                        {item.scenarioDelta && <span style={{ color: BLUE, fontSize: 10, border: `1px solid ${BLUE}30`, borderRadius: 999, padding: "1px 6px" }}>scenario delta</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.76)", lineHeight: 1.45 }}>{item.driver.text}</div>
                      {item.scenarioDelta ? (
                        <div style={{ marginTop: 3, fontSize: 10.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.45 }}>{item.scenarioDelta}</div>
                      ) : (
                        <div style={{ marginTop: 3, fontSize: 10.5, color: MUTED }}>Load pathway contrast to add lower-vs-higher scenario deltas.</div>
                      )}
                    </div>
                    <div style={{ flex: "1 1 82px" }}><div style={{ fontSize: 9, color: MUTED }}>Raw warming</div><div style={{ fontSize: 12.5, fontWeight: 800, color: RED }}>{signedNumber(item.tempChange, 1)}°C</div></div>
                    <div style={{ flex: "1 1 72px" }}><div style={{ fontSize: 9, color: MUTED }}>Heat days</div><div style={{ fontSize: 12.5, fontWeight: 800, color: ORANGE }}>{item.heatDays}</div></div>
                    <div style={{ flex: "1 1 82px" }}><div style={{ fontSize: 9, color: MUTED }}>Cold months</div><div style={{ fontSize: 12.5, fontWeight: 800, color: item.coldMonths > 0 ? CYAN : GREEN }}>{item.coldMonths}</div></div>
                    <div style={{ flex: "1 1 82px" }}><div style={{ fontSize: 9, color: MUTED }}>Water signal</div><div style={{ fontSize: 12.5, fontWeight: 800, color: BLUE }}>{signedNumber(item.precipChange, 1)}%</div></div>
                    <div style={{ flex: "1 1 90px" }}><div style={{ fontSize: 9, color: MUTED }}>Sea-level context</div><div style={{ fontSize: 12.5, fontWeight: 800, color: CYAN }}>{item.seaLevel} cm</div></div>
                    <div style={{ flex: "1 1 70px" }}><div style={{ fontSize: 9, color: MUTED }}>Score</div><div style={{ fontSize: 12.5, fontWeight: 800, color: scoreColor(item.score) }}>{item.score}/100</div></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${BLUE}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: "1 1 420px" }}>
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Scenario contrast · same location</h2>
              <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.68)", lineHeight: 1.6, margin: "6px 0 0" }}>
                Compare lower-warming, current-policy-adjacent, and higher-warming pathways for {placeName} without changing the selected place. These are pathway references, not predictions.
              </p>
            </div>
            <button
              onClick={loadScenarioContrast}
              disabled={scenarioContrastLoading || isLoading}
              aria-describedby="scenario-contrast-receipt"
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 7, border: `1px solid ${BLUE}55`, background: scenarioContrastRows.length > 0 ? `${BLUE}12` : `${BLUE}22`, color: "white", fontSize: 12, fontWeight: 800, cursor: scenarioContrastLoading || isLoading ? "wait" : "pointer", opacity: scenarioContrastLoading || isLoading ? 0.72 : 1 }}
            >
              {scenarioContrastLoading ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> : <GitCompare style={{ width: 13, height: 13 }} />}
              {scenarioContrastLoading ? "Loading pathways" : scenarioContrastRows.length > 0 ? "Refresh pathways" : "Load pathway contrast"}
            </button>
          </div>
          <div id="scenario-contrast-receipt" style={{ marginBottom: 10 }}>
            <ReceiptDetails label="method" text="Fetches the same annual checkpoints for each supported SSP scenario using the grounded /api/climate-trajectory endpoint and the same coordinates." />
            <ReceiptDetails label="default" text={`${DEFAULT_SCENARIO_EXPLANATION} Version: ${DEFAULT_SCENARIO_POLICY_VERSION}.`} />
          </div>

          {scenarioContrastError && (
            <div style={{ padding: "9px 11px", borderRadius: 8, border: `1px solid ${RED}35`, background: `${RED}12`, color: "#fca5a5", fontSize: 12, marginBottom: 10 }}>
              {scenarioContrastError}
            </div>
          )}

          {scenarioContrastTakeaway ? (
            <p style={{ margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.65, color: "rgba(255,255,255,0.88)" }}>
              <strong style={{ color: BLUE }}>Local pathway gap:</strong>{" "}
              {scenarioContrastTakeaway.text} This is the concrete local difference between lower and higher warming, not a claim that one pathway is guaranteed.
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: MUTED }}>
              Load the contrast to see how the same year changes under each supported SSP. The current forecast stays on {shownScenario.label}; the comparison only adds context.
            </p>
          )}

          {scenarioContrastRows.length > 0 && (
            <div>
              <ScenarioSmallMultiples
                metrics={scenarioSmallMultipleMetrics}
                selectedYear={displayYear}
                startYear={BASELINE_YEAR}
                endYear={MAX_YEAR}
              />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(205px, 1fr))", gap: 10 }}>
                {scenarioContrastRows.map((row) => {
                  const rowScoreColor = scoreColor(row.score);
                  const active = row.id === shownScenario.id;
                  return (
                    <div key={row.id} style={{ border: `1px solid ${active ? `${ACCENT}66` : BORDER}`, background: active ? `${ACCENT}10` : "rgba(255,255,255,0.035)", borderRadius: 8, padding: 11 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "white" }}>{row.label}</div>
                          <div style={{ fontSize: 10, color: active ? ACCENT : MUTED, marginTop: 2 }}>{row.role}</div>
                        </div>
                        {active && <span style={{ fontSize: 9, color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: 999, padding: "2px 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>shown</span>}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                        <div><div style={{ fontSize: 9, color: MUTED }}>Raw warming</div><div style={{ fontSize: 13, fontWeight: 800, color: RED }}>{signedNumber(row.tempChange, 1)}°C</div></div>
                        <div><div style={{ fontSize: 9, color: MUTED }}>IPCC assessed</div><div style={{ fontSize: 13, fontWeight: 800, color: AMBER }}>{signedNumber(row.ipccDelta, 1)}°C</div></div>
                        <div><div style={{ fontSize: 9, color: MUTED }}>Heat stress</div><div style={{ fontSize: 13, fontWeight: 800, color: ORANGE }}>{row.heatDays}/yr</div></div>
                        <div><div style={{ fontSize: 9, color: MUTED }}>Rainfall</div><div style={{ fontSize: 13, fontWeight: 800, color: BLUE }}>{signedNumber(row.precipChange, 1)}%</div></div>
                      </div>
                      <div style={{ marginTop: 9, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 10, color: MUTED }}>{row.category}</span>
                        <span style={{ fontSize: 15, fontWeight: 900, color: rowScoreColor }}>{row.score}/100</span>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <ReceiptDetails label="method" text="Same location and selected year; values interpolate from the annual trajectory returned by /api/climate-trajectory." />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {scoreStory && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 14 }}>
            <div style={{ ...card, padding: 18, borderLeft: `3px solid ${AMBER}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Why this changed</h2>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.62)", lineHeight: 1.55, margin: "6px 0 0" }}>
                    Ranked by score-component movement from {scoreStory.baselineYear} to {displayYear}; this is not a full causal attribution model.
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Score movement</div>
                  <div style={{ color: scoreStory.scoreDelta < 0 ? RED : GREEN, fontSize: 18, fontWeight: 800 }}>{signedNumber(scoreStory.scoreDelta, 0)} pts</div>
                  <div style={{ fontSize: 10, color: MUTED }}>{scoreStory.baselineScore} → {d!.score}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(116px, 1fr))", gap: 8, marginBottom: 12 }}>
                {scoreStory.trendRates.map((rate) => (
                  <div key={rate.label} style={{ background: "rgba(255,255,255,0.045)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 9px" }}>
                    <div style={{ fontSize: 10, color: MUTED, marginBottom: 3 }}>{rate.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: rate.color }}>{rate.value}</div>
                    <div style={{ marginTop: 6 }}>
                      <ReceiptDetails label="rate" text="Per-decade slope from the baseline point to the selected year." />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {scoreStory.scoreDrivers.length > 0 ? scoreStory.scoreDrivers.map((driver, index) => {
                  const helps = driver.effect >= 0;
                  return (
                    <div key={driver.key} style={{ display: "grid", gridTemplateColumns: "24px minmax(0, 1fr) auto", gap: 9, alignItems: "center" }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: helps ? `${GREEN}16` : `${RED}16`, color: helps ? GREEN : RED, fontSize: 11, fontWeight: 800 }}>{index + 1}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,0.92)" }}>{driver.label}</div>
                        <div style={{ fontSize: 10.5, color: MUTED }}>{driver.movement} · raw component {signedNumber(driver.delta, 1)}</div>
                        <div style={{ marginTop: 5 }}>
                          <ReceiptDetails label="method" text={`Baseline ${driver.baselineValue.toFixed(1)}; selected year ${driver.val.toFixed(1)}. Effect sign is adjusted so positive means helping the score.`} />
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: helps ? GREEN : RED }}>{signedNumber(driver.effect, 1)} pts</div>
                    </div>
                  );
                }) : (
                  <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.6 }}>No score component moved enough to rank; the modeled score is broadly stable at this horizon.</p>
                )}
              </div>
            </div>

            <div style={{ ...card, padding: 18, borderLeft: `3px solid ${GREEN}` }}>
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED, marginBottom: 12 }}>What this means for daily life</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {dailyLifeSignals.map((signal) => (
                  <div key={signal.label} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, paddingBottom: 11, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>{signal.label}</span>
                        <ReceiptDetails label="source" text={signal.receipt} />
                      </div>
                      <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.78)", lineHeight: 1.58 }}>{signal.text}</p>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: signal.color, whiteSpace: "nowrap" }}>{signal.value}</div>
                  </div>
                ))}
              </div>
              <p style={{ margin: "12px 0 0", fontSize: 10.5, lineHeight: 1.55, color: MUTED }}>
                Not yet included in the score: daily cold-stress days, crop yields, wildfire weather, biodiversity species ranges, local freshwater infrastructure, or parcel-level flood exposure.
              </p>
            </div>
          </div>
        )}

        {/* Habitability Assessment */}
        <div style={{ ...card, padding: 18, marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}><MetricTip k="habitability_score" value={d!.score}>Habitability Assessment</MetricTip></h2>
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

        {/* Sea-level rise — promoted to a prominent widget for coastal points.
            Previously this only appeared as a buried "context" line, which made
            it easy to miss for exactly the coastal cities it matters most to. */}
        {trajectory && d!.seaLevelApplicable && (
          <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${CYAN}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Waves style={{ width: 15, height: 15, color: CYAN }} />
                <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Sea-level rise · IPCC AR6 regional</h2>
              </div>
              {coastalRelevance?.shortLabel && (
                <span style={{ fontSize: 10, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 999, padding: "2px 8px" }}>{coastalRelevance.shortLabel}</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: CYAN }}>+{d!.seaLevel} cm</span>
              <span style={{ fontSize: 11, color: MUTED }}>regional rise by {displayYear}</span>
              {d!.seaLow != null && d!.seaHigh != null && (
                <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
                  likely range {Math.round(d!.seaLow)}–{Math.round(d!.seaHigh)} cm
                </span>
              )}
            </div>
            <p style={{ margin: "0 0 10px", fontSize: 12.5, lineHeight: 1.58, color: "rgba(255,255,255,0.78)" }}>
              {coastalRelevance?.summary ?? "Regional AR6 sea-level rise for the nearest coast."} Local exposure still depends on elevation, tides, subsidence, defenses, rivers, drainage, and storm surge — this is a regional figure, not a parcel-level coastal-flood assessment.
            </p>
            {floodRiver && floodActive && floodActive.floodedFraction > 0.005 && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 11px", borderRadius: 8, border: `1px solid ${CYAN}33`, background: `${CYAN}10`, marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>River-flood exposure</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: CYAN }}>{(floodActive.floodedFraction * 100).toFixed(floodActive.floodedFraction >= 0.1 ? 0 : 1)}%</span>
                <span style={{ fontSize: 10.5, color: MUTED }}>of the surrounding ~10 km · see the river-flood section below</span>
              </div>
            )}
            <ReceiptDetails
              label="source"
              text={`Regional AR6 sea-level rise via the registered NASA/IPCC AR6 source trail. ${coastalRelevance?.receipt ?? "Coastal relevance is a coarse Natural Earth nearest-coast screen, not a local exposure model."}`}
            />
          </div>
        )}

        {/* AMOC / Gulf Stream risk panel — qualitative IPCC AR6 + literature
            context for NW Europe and similar regions. Not a local number. */}
        {amoc?.regionRelevant && (
          <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${PURPLE}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle style={{ width: 15, height: 15, color: PURPLE }} />
                <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}><Term k="amoc">AMOC / Gulf Stream</Term> risk · IPCC AR6 + literature</h2>
              </div>
              <span style={{ fontSize: 9.5, color: PURPLE, border: `1px solid ${PURPLE}44`, borderRadius: 999, padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>qualitative context</span>
            </div>
            {amoc.status && (
              <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, lineHeight: 1.5, color: "white" }}>{amoc.status}</p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 10 }}>
              {[
                { label: "Weakening assessment", text: amoc.weakeningAssessment },
                { label: "Collapse risk", text: amoc.collapseRisk },
                { label: "Europe impact — cooling amid warming", text: amoc.europeImpact },
              ].filter((item) => item.text).map((item) => (
                <div key={item.label} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: 11, background: "rgba(255,255,255,0.032)" }}>
                  <div style={{ fontSize: 9, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 800, marginBottom: 5 }}>{item.label}</div>
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "rgba(255,255,255,0.82)" }}>{item.text}</p>
                </div>
              ))}
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 11, lineHeight: 1.55, color: MUTED }}>
              This is a real, honestly-bounded regional risk, not a local temperature correction: fupit applies no AMOC-driven cooling or warming number, no collapse date, and no deterministic local impact. A weakening circulation could partly offset greenhouse warming over NW Europe while raining disruption on storms, sea level, and rainfall patterns elsewhere.
            </p>

            {/* GROUNDED collapse-tail profile (NAHosMIP 0.3 Sv hosing ensemble).
                Quantified, multi-model, with spread. A low-probability, high-impact
                tail scenario — visually and semantically distinct from the likely
                weakening above, and never the central forecast. */}
            {amoc.collapseProfile && (() => {
              const cp = amoc.collapseProfile!;
              const fmt = (v: number, dp = 1) => `${v >= 0 ? "+" : ""}${v.toFixed(dp)}`;
              const tiles: Array<{ label: string; value: string; spread: string; note: string } | null> = [
                cp.temperature
                  ? {
                      label: "Cooler",
                      value: `${fmt(cp.temperature.mean)} °C`,
                      spread: `± ${cp.temperature.spread.toFixed(1)} across models`,
                      note: cp.temperature.mean < 0 ? "regional cooling even as the planet warms" : "regional temperature change",
                    }
                  : null,
                cp.precipitation
                  ? {
                      label: (cp.precipitation.pct ?? cp.precipitation.mean) >= 0 ? "Wetter" : "Drier",
                      value: cp.precipitation.pct !== null ? `${fmt(cp.precipitation.pct, 0)} %` : `${fmt(cp.precipitation.mean, 2)} mm/day`,
                      spread: `± ${cp.precipitation.spread.toFixed(2)} mm/day across models`,
                      note: "shift in average rainfall",
                    }
                  : null,
                cp.seaLevel
                  ? {
                      label: "Higher sea level",
                      value: `${fmt(cp.seaLevel.mean, 0)} cm`,
                      spread: `± ${cp.seaLevel.spread.toFixed(0)} cm across models`,
                      note: "regional dynamic sea level, on top of global rise",
                    }
                  : null,
                cp.pressure
                  ? {
                      label: "Stormier",
                      value: `${fmt(cp.pressure.mean, 1)} hPa`,
                      spread: `± ${cp.pressure.spread.toFixed(1)} hPa across models`,
                      note: "change in sea-level pressure / circulation",
                    }
                  : null,
              ];
              const shown = tiles.filter(Boolean) as Array<{ label: string; value: string; spread: string; note: string }>;
              if (shown.length === 0) return null;
              return (
                <div style={{ border: `1px solid ${RED}40`, borderRadius: 10, padding: 13, marginBottom: 10, background: `${RED}0c` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 9 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <Waves style={{ width: 14, height: 14, color: RED }} />
                      <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "white" }}>If the AMOC collapses · grounded impact profile</span>
                    </div>
                    <span style={{ fontSize: 9, color: RED, border: `1px solid ${RED}55`, borderRadius: 999, padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>low-probability · high-impact tail</span>
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: 11, lineHeight: 1.5, color: "rgba(255,255,255,0.78)" }}>
                    This is the collapse tail, not the central forecast and not tied to any year. The numbers are the multi-model average from the NAHosMIP 0.3 Sv hosing experiments ({cp.modelCount} models: {cp.models.join(", ")}); the spread across models is shown so you can see how much they disagree.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 9 }}>
                    {shown.map((t) => (
                      <div key={t.label} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: 11, background: "rgba(0,0,0,0.18)" }}>
                        <div style={{ fontSize: 9, color: RED, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 800, marginBottom: 4 }}>{t.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "white", lineHeight: 1.1 }}>{t.value}</div>
                        <div style={{ fontSize: 9.5, color: MUTED, marginTop: 3 }}>{t.spread}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 4, lineHeight: 1.4 }}>{t.note}</div>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: "9px 0 0", fontSize: 9.5, lineHeight: 1.45, color: MUTED }}>
                    Source: NAHosMIP (Jackson et al. 2023, doi:10.5194/gmd-16-1975-2023), CC-BY-SA-4.0. Collapsed-state minus pre-collapse baseline, regridded to 1°. Headline studies put the transient cooling at over 3 °C per decade and extra coastal sea-level rise up to about 50 cm (van Westen et al. 2024); those are cited context, not served here.
                  </p>
                </div>
              );
            })()}
            {amoc.citations && amoc.citations.length > 0 && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 10.5, lineHeight: 1.5, color: MUTED }}>
                {amoc.citations.map((c, i) => {
                  const text = typeof c === "string" ? c : [c.title, c.finding, c.sourceId].filter(Boolean).join(" — ");
                  const url = typeof c === "string" ? undefined : (c.url ?? (c.doi ? `https://doi.org/${c.doi}` : undefined));
                  return (
                    <li key={i}>
                      {url ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: MUTED, textDecoration: "underline", textUnderlineOffset: 2 }}>{text || url}</a> : text}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Freshwater availability — grounded WRI Aqueduct 4.0 sub-basin water stress */}
        {trajectory && (
          <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${BLUE}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Freshwater availability · WRI Aqueduct 4.0</h2>
              </div>
              {fwShown && (
                <span style={{ fontSize: 10, color: MUTED }}>{fwShown.aqueductScenarioLabel} pathway{fwIsSub ? " · substitute" : ""}</span>
              )}
            </div>

            {fwShown && fwActive ? (
              <>
                {fwIsSub && <SubstitutionNote scenario={fwShown.aqueductScenarioLabel} note={fwCoverage?.nearestScenario?.note} servedScenario={fwCoverage?.servedScenario} accent={BLUE} />}
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                  <MetricTip k="water_stress" value={fwActive.category}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: freshwaterCategoryColor(fwActive.category) }}>
                      {fwActive.label ?? "No data"}
                    </span>
                  </MetricTip>
                  <span style={{ fontSize: 11, color: MUTED }}><Term k="water_stress">water stress</Term> · {fwActive.year} horizon{fwActive.year !== displayYear ? ` (nearest to ${displayYear})` : ""}</span>
                </div>
                <p style={{ margin: "0 0 10px", fontSize: 12.5, lineHeight: 1.58, color: "rgba(255,255,255,0.78)" }}>
                  Annual water withdrawal versus available supply for the surrounding sub-basin under the {fwShown.aqueductScenarioLabel} scenario.
                  This is a basin-level prioritization screen, not a guarantee for your exact address.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  {fwShown.horizons.map((h) => (
                    <div key={h.year} style={{ flex: "1 1 90px", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 9px" }}>
                      <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h.year}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: freshwaterCategoryColor(h.category), lineHeight: 1.3 }}>{h.label ?? "No data"}</div>
                      {h.score != null && <div style={{ fontSize: 9.5, color: MUTED, marginTop: 2 }}>score {h.score}/5</div>}
                    </div>
                  ))}
                </div>
                <ReceiptDetails
                  label="source"
                  text={`${fwShown.attribution} ${fwShown.method} Sub-basin pfaf_id ${fwShown.pfafId ?? "n/a"}${fwShown.fallbackRings > 0 ? ` (nearest classified sub-basin, ${fwShown.fallbackRings} cell(s) away)` : ""}. License: attribution (WRI requests proper attribution).`}
                />
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 10.5, lineHeight: 1.5, color: MUTED }}>
                  {fwShown.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
                </ul>
              </>
            ) : (
              <EnrichmentEmptyState
                coverage={fwCoverage}
                fallback={scenario === "ssp245"
                  ? "Freshwater water-stress is not published for SSP2-4.5 by WRI Aqueduct, so no value is shown rather than guessing one."
                  : "WRI Aqueduct has no classified sub-basin for this point (for example open ocean), so no value is shown rather than guessing one."}
              />
            )}
          </div>
        )}

        {/* Fire weather — grounded Quilcaille 2023 CMIP6 Fire Weather Index */}
        {trajectory && (
          <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${ORANGE}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Fire weather · Quilcaille 2023 (CMIP6 FWI)</h2>
              </div>
              {fireShown && (
                <span style={{ fontSize: 10, color: MUTED }}>{fireShown.scenarioLabel} · {fireShown.modelCount}-model mean{fireIsSub ? " · substitute" : ""}</span>
              )}
            </div>

            {fireShown && fireActive ? (
              <>
                {fireIsSub && <SubstitutionNote scenario={fireShown.scenarioLabel} note={fireCoverage?.nearestScenario?.note} servedScenario={fireCoverage?.servedScenario} accent={ORANGE} />}
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                  <MetricTip k="extreme_fire_days" value={fireActive.extremeFireWeatherDays}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: ORANGE }}>
                      {fireActive.extremeFireWeatherDays != null ? `${fireActive.extremeFireWeatherDays.toFixed(0)} days/yr` : "No data"}
                    </span>
                  </MetricTip>
                  <span style={{ fontSize: 11, color: MUTED }}><Term k="extreme_fire_days">extreme fire-weather days</Term> · {fireActive.year} horizon{fireActive.year !== displayYear ? ` (nearest to ${displayYear})` : ""}</span>
                </div>
                <p style={{ margin: "0 0 10px", fontSize: 12.5, lineHeight: 1.58, color: "rgba(255,255,255,0.78)" }}>
                  Multi-model ensemble-mean fire-weather indicators for the surrounding ~250 km cell under the {fireShown.scenarioLabel} pathway.
                  This is a coarse weather screen for fire-conducive conditions, not a measure of actual fire risk, fuel, or ignition at your address.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  {fireShown.horizons.map((h) => (
                    <div key={h.year} style={{ flex: "1 1 90px", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 9px" }}>
                      <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h.year}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: ORANGE, lineHeight: 1.3 }}>{h.extremeFireWeatherDays != null ? `${h.extremeFireWeatherDays.toFixed(0)} days` : "No data"}</div>
                      {h.fireSeasonLengthDays != null && <div style={{ fontSize: 9.5, color: MUTED, marginTop: 2 }}>season {h.fireSeasonLengthDays.toFixed(0)} days</div>}
                    </div>
                  ))}
                </div>
                <ReceiptDetails
                  label="source"
                  text={`${fireShown.attribution} ${fireShown.method}${fireShown.fallbackRings > 0 ? ` Nearest land cell, ${fireShown.fallbackRings} cell(s) away.` : ""} License: CC-BY 4.0.`}
                />
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 10.5, lineHeight: 1.5, color: MUTED }}>
                  {fireShown.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
                </ul>
              </>
            ) : (
              <EnrichmentEmptyState
                coverage={fireCoverage}
                fallback="Fire-weather is not shown here. The Quilcaille fire-weather index covers land only and the four SSP pathways; over open ocean no value is shown rather than guessing one."
              />
            )}
          </div>
        )}

        {/* Riverine flood exposure — grounded WRI Aqueduct Floods 1-in-100-year */}
        {trajectory && (
          <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${CYAN}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>River-flood exposure · WRI Aqueduct Floods</h2>
              </div>
              {floodShown && (
                <span style={{ fontSize: 10, color: MUTED }}>{floodShown.aqueductScenarioLabel} · 1-in-100-year{floodIsSub ? " · substitute" : ""}</span>
              )}
            </div>

            {floodShown && floodActive ? (
              <>
                {floodIsSub && <SubstitutionNote scenario={floodShown.aqueductScenarioLabel} note={floodCoverage?.nearestScenario?.note} servedScenario={floodCoverage?.servedScenario} accent={CYAN} />}
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                  <MetricTip k="river_flood" value={floodActive.floodedFraction * 100}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: floodActive.floodedFraction > 0.01 ? CYAN : MUTED }}>
                      {(floodActive.floodedFraction * 100).toFixed(floodActive.floodedFraction >= 0.1 ? 0 : 1)}%
                    </span>
                  </MetricTip>
                  <span style={{ fontSize: 11, color: MUTED }}>of the surrounding ~10 km in the modeled floodplain · {floodActive.year} horizon{floodActive.year !== displayYear ? ` (nearest to ${displayYear})` : ""}</span>
                </div>
                <p style={{ margin: "0 0 10px", fontSize: 12.5, lineHeight: 1.58, color: "rgba(255,255,255,0.78)" }}>
                  {floodActive.floodedFraction > 0.01
                    ? <>About {(floodActive.floodedFraction * 100).toFixed(floodActive.floodedFraction >= 0.1 ? 0 : 1)}% of this ~10 km area falls in the modeled 1-in-100-year river floodplain{floodActive.meanFloodDepth != null ? `, with a mean modeled depth of ${floodActive.meanFloodDepth.toFixed(1)} m where it floods` : ""}. This is a regional screen, not a statement about your exact address.</>
                    : <>This area shows little or no modeled 1-in-100-year river-flood exposure. Local drainage, smaller streams, and coastal surge are not captured here.</>}
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  {floodShown.horizons.map((h) => (
                    <div key={h.year} style={{ flex: "1 1 90px", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 9px" }}>
                      <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h.year}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: h.floodedFraction > 0.01 ? CYAN : MUTED, lineHeight: 1.3 }}>{(h.floodedFraction * 100).toFixed(h.floodedFraction >= 0.1 ? 0 : 1)}% flooded</div>
                      {h.meanFloodDepth != null && <div style={{ fontSize: 9.5, color: MUTED, marginTop: 2 }}>~{h.meanFloodDepth.toFixed(1)} m deep</div>}
                    </div>
                  ))}
                </div>
                <ReceiptDetails
                  label="source"
                  text={`${floodShown.attribution} ${floodShown.method} License: attribution (WRI requests proper attribution).`}
                />
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 10.5, lineHeight: 1.5, color: MUTED }}>
                  {floodShown.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
                </ul>
              </>
            ) : (
              <EnrichmentEmptyState
                coverage={floodCoverage}
                fallback="River-flood exposure is not shown here. WRI Aqueduct Floods covers RCP4.5 (shown for SSP2-4.5) and RCP8.5 (shown for SSP5-8.5); SSP1-2.6 and SSP3-7.0 have no matching Aqueduct scenario, so no value is shown rather than guessing one."
              />
            )}
          </div>
        )}

        {/* Crop yields — grounded ISIMIP GGCMI ensemble-mean rainfed yield change */}
        {trajectory && (
          <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${GREEN}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Crop yields · ISIMIP GGCMI</h2>
              </div>
              {cropShown && (
                <span style={{ fontSize: 10, color: MUTED }}>{cropShown.scenarioLabel} · vs {cropShown.baselinePeriod}{cropIsSub ? " · substitute" : ""}</span>
              )}
            </div>

            {cropShown ? (
              <>
                {cropIsSub && <SubstitutionNote scenario={cropShown.scenarioLabel} note={cropCoverage?.nearestScenario?.note} servedScenario={cropCoverage?.servedScenario} accent={GREEN} />}
                <p style={{ margin: "0 0 10px", fontSize: 12.5, lineHeight: 1.58, color: "rgba(255,255,255,0.78)" }}>
                  Modeled change in rainfed yield of staple crops for the surrounding 0.5° cell under the {cropShown.scenarioLabel} pathway, as a multi-model ensemble mean.
                  This is a model-ensemble crop signal, not a field-level forecast for a specific farm.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  {cropShown.crops.map((cropSeries) => {
                    const active = cropSeries.horizons.reduce((best, h) => (Math.abs(h.year - displayYear) < Math.abs(best.year - displayYear) ? h : best));
                    const pct = active.yieldChangePercent;
                    const color = pct == null ? MUTED : pct >= 2 ? GREEN : pct <= -2 ? RED : AMBER;
                    return (
                      <div key={cropSeries.crop} style={{ flex: "1 1 120px", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>{cropSeries.label}</div>
                        <MetricTip k="crop_yield" value={pct}>
                          <div style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1.3 }}>
                            {pct == null ? "No data" : `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`}
                          </div>
                        </MetricTip>
                        <div style={{ fontSize: 9.5, color: MUTED, marginTop: 2 }}>{active.year} horizon{active.year !== displayYear ? ` (nearest to ${displayYear})` : ""}</div>
                      </div>
                    );
                  })}
                </div>
                <ReceiptDetails
                  label="source"
                  text={`${cropShown.attribution} ${cropShown.method} License: CC0 1.0 (public domain).`}
                />
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 10.5, lineHeight: 1.5, color: MUTED }}>
                  {cropShown.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
                </ul>
              </>
            ) : (
              <EnrichmentEmptyState
                coverage={cropCoverage}
                fallback={scenario === "ssp245"
                  ? "Crop-yield change is not in the ISIMIP GGCMI phase 3 core protocol for SSP2-4.5, so no value is shown rather than guessing one."
                  : "No staple crop is grown in the ISIMIP GGCMI cell for this point (for example open ocean or desert), so no value is shown rather than guessing one."}
              />
            )}
          </div>
        )}

        {/* Humid heat — grounded NASA NEX-GDDP-CMIP6 daily wet-bulb (Stull 2011) exceedance days */}
        {trajectory && (
          <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${RED}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Humid heat · NASA NEX-GDDP-CMIP6</h2>
              </div>
              {humidHeat && <span style={{ fontSize: 10, color: MUTED }}>{humidHeat.model} · ~25 km</span>}
            </div>
            {humidHeat && humidActive ? (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                  <MetricTip k="humid_heat_days" value={humidActive.daysAbove28}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: (humidActive.daysAbove28 ?? 0) > 30 ? RED : (humidActive.daysAbove28 ?? 0) > 5 ? ORANGE : MUTED }}>
                      {humidActive.daysAbove28 != null ? `${humidActive.daysAbove28.toFixed(0)} days/yr` : "No data"}
                    </span>
                  </MetricTip>
                  <span style={{ fontSize: 11, color: MUTED }}><Term k="wet_bulb">wet-bulb</Term> above 28 °C · {humidActive.year} horizon{humidActive.year !== displayYear ? ` (nearest to ${displayYear})` : ""}</span>
                </div>
                <p style={{ margin: "0 0 10px", fontSize: 12.5, lineHeight: 1.58, color: "rgba(255,255,255,0.78)" }}>
                  Modeled days per year with a daily-mean wet-bulb above 28 °C ({humidActive.daysAbove31 != null ? `${humidActive.daysAbove31.toFixed(0)} above 31 °C, ` : ""}{humidActive.daysAbove35 != null ? `${humidActive.daysAbove35.toFixed(0)} above 35 °C` : ""}) for the surrounding ~25 km cell.
                  A regional humidity-heat screen, not measured WBGT.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  {humidHeat.horizons.map((h) => (
                    <div key={h.window} style={{ flex: "1 1 120px", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h.year} · Tw&gt;28</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: RED, lineHeight: 1.3 }}>{h.daysAbove28 != null ? `${h.daysAbove28.toFixed(0)} days` : "No data"}</div>
                      {h.daysAbove35 != null && <div style={{ fontSize: 9.5, color: MUTED, marginTop: 2 }}>{h.daysAbove35.toFixed(0)} d &gt;35 °C</div>}
                    </div>
                  ))}
                </div>
                <ReceiptDetails label="source" text={`${humidHeat.attribution} ${humidHeat.method} License: CC0 1.0 (public domain).`} />
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 10.5, lineHeight: 1.5, color: MUTED }}>
                  {humidHeat.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
                </ul>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.58, color: MUTED }}>
                Humid-heat exceedance days are not shown for this point (outside the modeled grid), so no value is shown rather than guessing one.
              </p>
            )}
          </div>
        )}

        {/* Cold-season context — grounded NASA NEX-GDDP-CMIP6 daily ETCCDI cold indices */}
        {trajectory && (
          <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${BLUE}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Cold season · NASA NEX-GDDP-CMIP6 (ETCCDI)</h2>
              </div>
              {coldSeason && <span style={{ fontSize: 10, color: MUTED }}>{coldSeason.model} · ~25 km</span>}
            </div>
            {coldSeason && coldActive ? (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                  <MetricTip k="frost_days" value={coldActive.frostDays}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: (coldActive.frostDays ?? 0) > 60 ? CYAN : (coldActive.frostDays ?? 0) > 5 ? BLUE : MUTED }}>
                      {coldActive.frostDays != null ? `${coldActive.frostDays.toFixed(0)} frost days/yr` : "No data"}
                    </span>
                  </MetricTip>
                  <span style={{ fontSize: 11, color: MUTED }}>tasmin below 0 °C · {coldActive.year} horizon{coldActive.year !== displayYear ? ` (nearest to ${displayYear})` : ""}</span>
                </div>
                <p style={{ margin: "0 0 10px", fontSize: 12.5, lineHeight: 1.58, color: "rgba(255,255,255,0.78)" }}>
                  Modeled ETCCDI cold indices for the surrounding ~25 km cell: {coldActive.iceDays != null ? `${coldActive.iceDays.toFixed(0)} ice days (max below 0 °C), ` : ""}{coldActive.minTasminC != null ? `coldest night around ${coldActive.minTasminC.toFixed(0)} °C, ` : ""}{coldActive.coldSpellDays != null ? `${coldActive.coldSpellDays.toFixed(0)} days in cold spells` : ""}.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  {coldSeason.horizons.map((h) => (
                    <div key={h.window} style={{ flex: "1 1 120px", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h.year} · frost</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: BLUE, lineHeight: 1.3 }}>{h.frostDays != null ? `${h.frostDays.toFixed(0)} days` : "No data"}</div>
                      {h.minTasminC != null && <div style={{ fontSize: 9.5, color: MUTED, marginTop: 2 }}>TNn {h.minTasminC.toFixed(0)} °C</div>}
                    </div>
                  ))}
                </div>
                <ReceiptDetails label="source" text={`${coldSeason.attribution} ${coldSeason.method} License: CC0 1.0 (public domain).`} />
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 10.5, lineHeight: 1.5, color: MUTED }}>
                  {coldSeason.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
                </ul>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.58, color: MUTED }}>
                Cold-season indices are not shown for this point (outside the modeled grid), so no value is shown rather than guessing one.
              </p>
            )}
          </div>
        )}

        {/* Thermal load (degree-days) — grounded NASA NEX-GDDP-CMIP6 base-18 °C degree-days */}
        {trajectory && (
          <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${PURPLE}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Thermal load · NASA NEX-GDDP-CMIP6 (degree-days)</h2>
              </div>
              {degreeDays && <span style={{ fontSize: 10, color: MUTED }}>base {degreeDays.degreeDayBaseC} °C · ~25 km</span>}
            </div>
            {degreeDays && ddActive ? (
              <>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 6 }}>
                  <div>
                    <MetricTip k="cooling_degree_days" value={ddActive.coolingDegreeDays}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: AMBER }}>{ddActive.coolingDegreeDays != null ? ddActive.coolingDegreeDays.toFixed(0) : "—"}</span>
                    </MetricTip>
                    <span style={{ fontSize: 11, color: MUTED }}> cooling <Term k="degree_day_unit">°C·days/yr</Term></span>
                  </div>
                  <div>
                    <MetricTip k="heating_degree_days" value={ddActive.heatingDegreeDays}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: BLUE }}>{ddActive.heatingDegreeDays != null ? ddActive.heatingDegreeDays.toFixed(0) : "—"}</span>
                    </MetricTip>
                    <span style={{ fontSize: 11, color: MUTED }}> heating <Term k="degree_day_unit">°C·days/yr</Term></span>
                  </div>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: 13, lineHeight: 1.55, color: "white", fontWeight: 600 }}>
                  What this means: a big heating number = a cold place that needs a lot of heating; a big cooling number = a hot place that needs a lot of air-conditioning. As the world warms, the heating number falls and the cooling number rises.
                </p>
                <p style={{ margin: "0 0 10px", fontSize: 12.5, lineHeight: 1.58, color: "rgba(255,255,255,0.78)" }}>
                  Modeled base-{degreeDays.degreeDayBaseC} °C cooling and heating <Term k="degree_days">degree-days</Term> for the surrounding ~25 km cell at the {ddActive.year} horizon{ddActive.year !== displayYear ? ` (nearest to ${displayYear})` : ""} — a screen for thermal energy demand, not a building-level estimate.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  {degreeDays.horizons.map((h) => (
                    <div key={h.window} style={{ flex: "1 1 120px", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h.year} · cool / heat</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: AMBER, lineHeight: 1.3 }}>{h.coolingDegreeDays != null ? `${h.coolingDegreeDays.toFixed(0)}` : "—"}<span style={{ color: MUTED, fontWeight: 600 }}> / {h.heatingDegreeDays != null ? h.heatingDegreeDays.toFixed(0) : "—"}</span></div>
                    </div>
                  ))}
                </div>
                <ReceiptDetails label="source" text={`${degreeDays.attribution} ${degreeDays.method} License: CC0 1.0 (public domain).`} />
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 10.5, lineHeight: 1.5, color: MUTED }}>
                  {degreeDays.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
                </ul>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.58, color: MUTED }}>
                Degree-days are not shown for this point (outside the modeled grid), so no value is shown rather than guessing one.
              </p>
            )}
          </div>
        )}

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

        {learningPrompts.length > 0 && (
          <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${BLUE}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ flex: "1 1 440px" }}>
                <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Questions to test next</h2>
                <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.68)", lineHeight: 1.6 }}>
                  A useful forecast should change what you compare. These prompts reuse the same grounded fields and routes, so the next click stays inspectable.
                </p>
              </div>
              <ReceiptDetails label="scope" text="Prompts are generated from the visible forecast, scenario contrast, and bounded climate-twin catalog. They are learning prompts, not advice to move, invest, insure, or rank safe havens." />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
              {learningPrompts.map((prompt) => {
                const busy = prompt.action === "pathways" && scenarioContrastLoading;
                const disabled = prompt.disabled || busy;
                const accent = prompt.action === "twin" ? PURPLE : prompt.action === "comparison" ? ACCENT : BLUE;
                return (
                  <div key={prompt.eyebrow} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, background: "rgba(255,255,255,0.032)" }}>
                    <div style={{ fontSize: 9, color: accent, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 850, marginBottom: 7 }}>{prompt.eyebrow}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.45, fontWeight: 800, color: "white", marginBottom: 7 }}>{prompt.question}</div>
                    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: "rgba(255,255,255,0.72)" }}>{prompt.detail}</p>
                    <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                      <ReceiptDetails label="receipt" text={prompt.receipt} />
                      <button
                        disabled={disabled}
                        onClick={() => {
                          if (prompt.action === "pathways") { void loadScenarioContrast(); return; }
                          if (prompt.action === "twin") { openClimateTwinCity(); return; }
                          window.location.href = "/comparison";
                        }}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 7, border: `1px solid ${accent}55`, background: `${accent}16`, color: "white", fontSize: 11.5, fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1 }}
                      >
                        {busy ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : prompt.action === "comparison" ? <GitCompare style={{ width: 12, height: 12 }} /> : <ExternalLink style={{ width: 12, height: 12 }} />}
                        {busy ? "Loading" : prompt.actionLabel}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* KPI Strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 14 }}>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 4 }}>Avg Temperature</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ fontSize: 24, fontWeight: 700 }}>{d!.avgTemp.toFixed(1)}°C</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: RED }}>+{d!.tempChange.toFixed(1)}°</span>
            </div>
            <div style={{ marginTop: 7 }}>
              <ReceiptDetails label="source" text="Raw CMIP6 model-consensus annual_mean and anomaly for the selected SSP scenario. Trend range uses temperature.uncertainty.annual_mean_low/high when exposed by the grounded API." />
            </div>
          </div>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 4 }}>Annual Precip</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ fontSize: 24, fontWeight: 700 }}>{d!.annualPrecip}mm</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: BLUE }}>{d!.precipChange >= 0 ? "+" : ""}{d!.precipChange.toFixed(1)}%</span>
            </div>
            <div style={{ marginTop: 7 }}>
              <ReceiptDetails label="source" text="Annual precipitation total and anomaly_percent from the grounded precipitation projection. It does not include groundwater, reservoirs, demand, or local drainage capacity." />
            </div>
          </div>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 4 }}>Heat Stress</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ fontSize: 24, fontWeight: 700 }}>{d!.heatDays}</span>
              <span style={{ fontSize: 12, color: MUTED }}>days/yr</span>
            </div>
            <div style={{ marginTop: 6, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
              <div style={{ height: "100%", borderRadius: 2, background: ORANGE, width: `${Math.min((d!.heatDays / Math.max(...traj!.heat, 1)) * 100, 100)}%`, transition: "width 0.25s ease" }} />
            </div>
            <div style={{ marginTop: 7 }}>
              <ReceiptDetails label="source" text="Heat-stress days come from the grounded extremes layer returned by /api/climate-trajectory. Treat as a climate screening indicator, not medical or occupational-safety advice." />
            </div>
          </div>
          <div style={{ ...card, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 4 }}>Habitability</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{d!.score}<span style={{ fontSize: 14, color: MUTED }}>/100</span></div>
              <div style={{ fontSize: 11, fontWeight: 600, color: sc, marginTop: 2 }}>{d!.category}</div>
              <div style={{ marginTop: 7 }}>
                <ReceiptDetails label="method" text="Habitability is the score returned by the grounded grid engine from its visible climate component breakdown. It is educational context, not a safety certificate or relocation recommendation." />
              </div>
            </div>
            <div style={{ position: "relative", width: 54, height: 54 }}>
              <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={sc} strokeWidth="4" strokeDasharray={`${d!.score}, 100`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.3s ease" }} />
              </svg>
            </div>
          </div>
        </div>

    </>
  );
}
