import { useState, useEffect, useMemo, useRef } from "react";
import {
  BG, CARD, BORDER, ACCENT, MUTED, RED, BLUE, ORANGE, GREEN, AMBER, PURPLE, CYAN,
  FONT_DISPLAY, FONT_MONO, card, MONTHS, BASELINE_YEAR, MAX_YEAR, CURRENT_FORECAST_YEAR,
  FIVE_YEAR_CHECKPOINTS, CHECKPOINTS, YEAR_TICKS, QUICK_YEAR_BUTTONS, ROADMAP_YEARS,
  FREEZING_MONTHLY_MEAN_C, SCENARIOS, DEFAULT_SCENARIO, DEFAULT_SCENARIO_POLICY_VERSION,
  DEFAULT_SCENARIO_EXPLANATION, SCENARIO_LINE_COLORS,
} from "@/lib/climate-constants";
import type {
  ScenarioId, CoastCoord, LocationOption, ProjectionPoint, AnalogCandidate, AnalogCatalog,
  CoastalProximityArtifact, CoastalRelevance, ClimateAnalogMatch, ScenarioContrastRow,
  RoadmapItem, ShareStory, LearningPromptAction, LearningPrompt, FreshwaterStress, FireWeather, FloodExposure, CropYield,
  EnrichmentCoverage, AmocAssessment,
} from "@/lib/climate-types";
import {
  lerp, interpScalar, interpOptionalScalar, riskScore, interpArr, nearestPoint, categoryFor,
  scoreColor, signedNumber, roundedValue, normalizeLngDelta, distancePointToSegmentKm,
  nearestCoastDistanceKm, formatDistanceKm, coastalRelevanceFor, climateVector,
  candidateClimateVector, sameCatalogPlace, findClimateAnalog, prettify, confidenceColor,
  feedbackTag, componentScoreEffect, isDriverComponent, perDecade, describeSignalLevel,
  heatLifeText, countMonthlyFreezeContext, coldSeasonLifeText, precipitationLifeText,
  circulationContextFor, scenarioInfo, scenarioRole, contrastSnapshot, roadmapDriver,
  roadmapSnapshot, jsonFileSlug, parseScenario, forecastUrl, linkLocationFromParams, linkLocationFromPlaceRoute, parseCoordinateSlugClient, crossYear,
} from "@/lib/climate-helpers";
import { buildShareImageSvg, svgToPngBlob, downloadBlob, copyToClipboard } from "@/lib/share-card";
import { useBirthYear } from "@/lib/use-birth-year";
import { rescoreTrajectory, parityDrift } from "@/lib/habitability";
import { usePrefs, encodePrefs } from "@/lib/use-prefs";
import {
  deriveTraj, deriveSnapshot, deriveScoreStory, deriveScoreSensitivityInputs,
  deriveScenarioContrastRows, deriveScenarioContrastTakeaway, deriveRoadmapItems,
  deriveCoastalRelevance, deriveTipping, deriveScenarioSmallMultipleMetrics,
  deriveDailyLifeSignals, deriveShareStory, deriveLearningPrompts,
} from "@/lib/climate-derivations";
import type { ScoreSensitivityInput } from "@/components/score-sensitivity";
import type { ScenarioSmallMultipleMetric } from "@/components/scenario-small-multiples";

export function useClimateApp() {
  const [locationText, setLocationText] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const [suggestions, setSuggestions] = useState<LocationOption[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [year, setYear] = useState(CURRENT_FORECAST_YEAR);
  const [scenario, setScenario] = useState<ScenarioId>(DEFAULT_SCENARIO);
  // Optional birth year — shared client-side store (localStorage), never sent to the server.
  const [birthYear, setBirthYear] = useBirthYear();
  // "Your conditions" — comfort prefs, also client-side. Re-scoring is local + instant.
  const [prefs, setPrefs] = usePrefs();
  const [trajectory, setTrajectory] = useState<ProjectionPoint[] | null>(null);
  const [freshwater, setFreshwater] = useState<FreshwaterStress | null>(null);
  const [fireWeather, setFireWeather] = useState<FireWeather | null>(null);
  const [floodRiver, setFloodRiver] = useState<FloodExposure | null>(null);
  const [cropYield, setCropYield] = useState<CropYield | null>(null);
  // Coverage map + AMOC assessment travel alongside the enrichments so a null
  // enrichment can still explain itself, and NW-Europe coastal points get the
  // AMOC/Gulf Stream risk panel. Both optional in the contract.
  const [coverage, setCoverage] = useState<EnrichmentCoverage | null>(null);
  const [amoc, setAmoc] = useState<AmocAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareStoryCopied, setShareStoryCopied] = useState(false);
  const [shareImageBusy, setShareImageBusy] = useState(false);
  const [shareImageSaved, setShareImageSaved] = useState(false);
  const [rawJsonCopied, setRawJsonCopied] = useState(false);
  const [reportSaved, setReportSaved] = useState(false);
  const [analogCatalog, setAnalogCatalog] = useState<AnalogCatalog | null>(null);
  const [analogError, setAnalogError] = useState<string | null>(null);
  const [coastalArtifact, setCoastalArtifact] = useState<CoastalProximityArtifact | null>(null);
  const [coastalArtifactError, setCoastalArtifactError] = useState<string | null>(null);
  const [scenarioContrast, setScenarioContrast] = useState<Partial<Record<ScenarioId, ProjectionPoint[]>> | null>(null);
  const [scenarioContrastLoading, setScenarioContrastLoading] = useState(false);
  const [scenarioContrastError, setScenarioContrastError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const deepLinkRunRef = useRef(false);

  useEffect(() => {
    document.title = "fupit — see where the climate is still livable";
  }, []);

  // Persist the optional birth year locally only.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (birthYear && Number.isFinite(birthYear)) window.localStorage.setItem("fupit.birthYear", String(birthYear));
    else window.localStorage.removeItem("fupit.birthYear");
  }, [birthYear]);

  useEffect(() => {
    let cancelled = false;
    fetch("/climate-analog-catalog.current.json")
      .then((response) => {
        if (!response.ok) throw new Error("catalog_unavailable");
        return response.json();
      })
      .then((catalog: AnalogCatalog) => {
        if (!cancelled) setAnalogCatalog(catalog);
      })
      .catch(() => {
        if (!cancelled) setAnalogError("Climate twin catalog unavailable");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/coastal-proximity.natural-earth-110m.json")
      .then((response) => {
        if (!response.ok) throw new Error("coastal_proximity_unavailable");
        return response.json();
      })
      .then((artifact: CoastalProximityArtifact) => {
        if (cancelled) return;
        if (artifact.catalog !== "natural_earth_coastline_110m" || artifact.sourceId !== "natural-earth-coastline-110m-v5" || !Array.isArray(artifact.lines)) {
          throw new Error("coastal_proximity_invalid");
        }
        setCoastalArtifact(artifact);
      })
      .catch(() => {
        if (!cancelled) setCoastalArtifactError("Coastal proximity artifact unavailable");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // Deep links: ?lat=&lng=... share URLs first, then per-location pages.
    const apply = (linked: { location: typeof selectedLocation; year?: number; scenario: typeof scenario; autoRun: boolean }) => {
      if (!linked.location) return;
      setSelectedLocation(linked.location);
      setLocationText(linked.location.name);
      setShowSuggestions(false);
      // Per-location pages headline the year-2100 projection; honour an explicit
      // year when present, else default to MAX_YEAR for the "in 2100" hook.
      setYear(linked.year ?? (window.location.pathname.startsWith("/place/") ? MAX_YEAR : CURRENT_FORECAST_YEAR));
      setScenario(linked.scenario);
      deepLinkRunRef.current = linked.autoRun;
    };

    const fromParams = linkLocationFromParams();
    if (fromParams) { apply(fromParams); return; }

    const fromPlace = linkLocationFromPlaceRoute();
    if (fromPlace) { apply(fromPlace); return; }

    // Catalog slug reached by client-side navigation (no server island): resolve
    // coordinates via the model-free resolver endpoint, then auto-run.
    const m = window.location.pathname.match(/^\/place\/(.+)$/);
    if (!m) return;
    const slug = decodeURIComponent(m[1]);
    if (parseCoordinateSlugClient(slug)) return; // already handled by linkLocationFromPlaceRoute
    let cancelled = false;
    fetch(`/api/place/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { name?: string; country?: string; lat?: number; lng?: number } | null) => {
        if (cancelled || !data || typeof data.lat !== "number" || typeof data.lng !== "number") return;
        const name = (data.name && data.name.trim()) || `${data.lat.toFixed(2)}, ${data.lng.toFixed(2)}`;
        apply({
          location: { name, lat: data.lat, lng: data.lng, country: data.country || "", city: name.split(",")[0] || name },
          scenario: DEFAULT_SCENARIO,
          autoRun: true,
        });
      })
      .catch(() => { /* unknown slug -> SPA shows the default landing */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".location-input-container")) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (locationText.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/locations/search?q=${encodeURIComponent(locationText)}`);
        const data = await response.json();
        setSuggestions(Array.isArray(data) ? data : []);
        setShowSuggestions(true);
      } catch (err) {
        console.warn("Location search failed:", err);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [locationText]);

  useEffect(() => {
    if (!isLoading) { setLoadingStep(0); return; }
    const id = setInterval(() => setLoadingStep((s) => Math.min(s + 1, CHECKPOINTS.length - 1)), 4000);
    return () => clearInterval(id);
  }, [isLoading]);

  // Auto-glide the year slider from the current forecast year to 2100.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const SPEED = (MAX_YEAR - CURRENT_FORECAST_YEAR) / 11000; // years per ms -> full sweep approx 11s
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100); // clamp big gaps (tab refocus)
      last = now;
      setYear((y) => Math.min(MAX_YEAR, y + dt * SPEED));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // Stop playback once the timeline reaches the end.
  useEffect(() => {
    if (playing && year >= MAX_YEAR) setPlaying(false);
  }, [playing, year]);

  const togglePlay = () => {
    if (playing) { setPlaying(false); return; }
    if (year >= MAX_YEAR - 0.5) setYear(CURRENT_FORECAST_YEAR); // replay from the current forecast start
    setPlaying(true);
  };

  const setYearManual = (y: number) => { setPlaying(false); setYear(y); };

  const selectLocation = (opt: LocationOption) => {
    setSelectedLocation(opt);
    setLocationText(opt.name);
    setShowSuggestions(false);
  };

  const fetchTrajectory = async (targetLocation: LocationOption, scenarioOverride: ScenarioId): Promise<{ points: ProjectionPoint[]; freshwater: FreshwaterStress | null; fireWeather: FireWeather | null; floodRiver: FloodExposure | null; cropYield: CropYield | null; coverage: EnrichmentCoverage | null; amoc: AmocAssessment | null }> => {
    const response = await fetch("/api/climate-trajectory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: { lat: targetLocation.lat, lng: targetLocation.lng }, years: CHECKPOINTS, scenario: scenarioOverride }),
    });
    if (!response.ok) {
      let detail = response.statusText;
      try { const e = await response.json(); detail = e.message || detail; } catch { /* ignore */ }
      throw new Error(detail);
    }
    const data = await response.json();
    if (data.success && data.data?.points?.length) {
      const points = [...data.data.points].sort((a: ProjectionPoint, b: ProjectionPoint) => a.year - b.year);
      return {
        points,
        freshwater: (data.data.freshwater as FreshwaterStress | null) ?? null,
        fireWeather: (data.data.fireWeather as FireWeather | null) ?? null,
        floodRiver: (data.data.floodRiver as FloodExposure | null) ?? null,
        cropYield: (data.data.cropYield as CropYield | null) ?? null,
        // Coverage + AMOC live at the top level of the response in the final
        // contract; fall back to data.data.* so either placement degrades fine.
        coverage: (data.coverage ?? data.data.coverage ?? null) as EnrichmentCoverage | null,
        amoc: (data.amoc ?? data.data.amoc ?? null) as AmocAssessment | null,
      };
    }
    throw new Error("Invalid response from climate model.");
  };

  const generate = async (locationOverride?: LocationOption, scenarioOverride: ScenarioId = scenario) => {
    const targetLocation = locationOverride ?? selectedLocation;
    if (!targetLocation) { setError("Please select a location from the suggestions."); return; }
    setError(null);
    setIsLoading(true);
    setTrajectory(null);
    setFreshwater(null);
    setFireWeather(null);
    setFloodRiver(null);
    setCropYield(null);
    setCoverage(null);
    setAmoc(null);
    setScenarioContrast(null);
    setScenarioContrastError(null);
    try {
      const result = await fetchTrajectory(targetLocation, scenarioOverride);
      setTrajectory(result.points);
      setFreshwater(result.freshwater);
      setFireWeather(result.fireWeather);
      setFloodRiver(result.floodRiver);
      setCropYield(result.cropYield);
      setCoverage(result.coverage);
      setAmoc(result.amoc);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadScenarioContrast = async () => {
    if (!selectedLocation || !trajectory || scenarioContrastLoading) return;
    setScenarioContrastLoading(true);
    setScenarioContrastError(null);
    try {
      const next: Partial<Record<ScenarioId, ProjectionPoint[]>> = { [scenario]: trajectory };
      for (const row of SCENARIOS) {
        if (!next[row.id]) next[row.id] = (await fetchTrajectory(selectedLocation, row.id)).points;
      }
      setScenarioContrast(next);
    } catch (err) {
      setScenarioContrastError(err instanceof Error ? err.message : "Scenario contrast could not be loaded.");
    } finally {
      setScenarioContrastLoading(false);
    }
  };

  const changeScenario = (next: ScenarioId) => {
    setScenario(next);
    setShareCopied(false);
    setPlaying(false);
    if (trajectory && selectedLocation) {
      void generate(selectedLocation, next);
    }
  };

  useEffect(() => {
    if (!selectedLocation || !deepLinkRunRef.current || isLoading || trajectory) return;
    deepLinkRunRef.current = false;
    void generate(selectedLocation, scenario);
  }, [selectedLocation, isLoading, trajectory, scenario]);

  const newSearch = () => {
    setPlaying(false);
    setTrajectory(null);
    setFreshwater(null);
    setFireWeather(null);
    setFloodRiver(null);
    setCropYield(null);
    setCoverage(null);
    setAmoc(null);
    setError(null);
    setShareCopied(false);
    setRawJsonCopied(false);
    setReportSaved(false);
    setScenarioContrast(null);
    setScenarioContrastError(null);
    window.history.replaceState(null, "", "/");
  };

  const exportPDF = async () => {
    if (!resultsRef.current || exporting) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(resultsRef.current, { backgroundColor: "#0b111e", scale: 2, useCORS: true });
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position -= pageH;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
        heightLeft -= pageH;
      }
      const name = selectedLocation?.city || selectedLocation?.name.split(",")[0] || "location";
      pdf.save(`climate-projection-${name}-${Math.round(year)}-${scenario}.pdf`);
    } catch (err) {
      console.warn("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  // Derived trend arrays (stable per trajectory)
  // Re-score for the user's comfort prefs. Identity (same ref) at defaults, so the
  // canonical grounded score is preserved and memoization stays cheap. Everything the
  // user *experiences* derives from this; raw exports below stay canonical.
  const scoredTrajectory = useMemo(() => rescoreTrajectory(trajectory, prefs), [trajectory, prefs]);

  // Dev-only parity guard: our default-pref score must match the server's (ε rounding).
  useEffect(() => {
    if (!import.meta.env?.DEV || !trajectory) return;
    const drift = parityDrift(trajectory);
    if (drift > 0.6) console.warn(`[habitability parity] client/server score drift ${drift.toFixed(2)} > 0.6 — TS port may be out of sync with grounded_model.py`);
  }, [trajectory]);

  const traj = useMemo(() => deriveTraj(scoredTrajectory), [scoredTrajectory]);

  // Snapshot at current slider year
  const d = useMemo(() => deriveSnapshot(scoredTrajectory, year), [scoredTrajectory, year]);

  const displayYear = Math.round(year);

  const climateAnalog = useMemo(() => {
    if (!analogCatalog || !selectedLocation || !d) return null;
    return findClimateAnalog(analogCatalog, selectedLocation, displayYear, d);
  }, [analogCatalog, selectedLocation, d, displayYear]);

  const coastalRelevance = useMemo<CoastalRelevance | null>(() => deriveCoastalRelevance(selectedLocation, coastalArtifact, coastalArtifactError), [selectedLocation, coastalArtifact, coastalArtifactError]);

  const scenarioContrastRows = useMemo(() => deriveScenarioContrastRows(scenarioContrast, displayYear), [scenarioContrast, displayYear]);

  const scenarioSmallMultipleMetrics = useMemo<ScenarioSmallMultipleMetric[]>(() => deriveScenarioSmallMultipleMetrics(scenarioContrast, scenario, coastalRelevance), [scenarioContrast, scenario, coastalRelevance]);

  const scenarioContrastTakeaway = useMemo(() => deriveScenarioContrastTakeaway(scenarioContrastRows, displayYear), [scenarioContrastRows, displayYear]);

  const roadmapItems = useMemo(() => deriveRoadmapItems(scoredTrajectory, scenarioContrast, ROADMAP_YEARS), [scoredTrajectory, scenarioContrast]);

  const scoreStory = useMemo(() => deriveScoreStory(scoredTrajectory, d, displayYear), [scoredTrajectory, d, displayYear]);

  const scoreSensitivityInputs = useMemo<ScoreSensitivityInput[]>(() => deriveScoreSensitivityInputs(d), [d]);

  const dailyLifeSignals = useMemo(() => deriveDailyLifeSignals(d, scoreStory, scenario, selectedLocation, coastalRelevance), [d, scoreStory, scenario, selectedLocation, coastalRelevance]);

  // Tipping points computed from real interpolated trajectory
  const tipping = useMemo(() => deriveTipping(scoredTrajectory, coastalRelevance), [scoredTrajectory, coastalRelevance]);

  const selectedScenario = scenarioInfo(scenario);
  const shownScenario = scenarioInfo(d?.scenario ?? scenario);
  // Share URL carries the place + the sender's lens (their non-default prefs). Birth year
  // is deliberately NOT encoded (it would leak the sender's age). Default prefs add nothing,
  // so standard links stay clean. Prefs ride the page URL only — the API stays pref-free.
  const shareUrl = useMemo(() => {
    if (!selectedLocation) return "";
    const base = forecastUrl(selectedLocation, displayYear, scenario, true);
    const lens = encodePrefs(prefs);
    if (Object.keys(lens).length === 0) return base;
    const u = new URL(base);
    for (const [k, v] of Object.entries(lens)) u.searchParams.set(k, v);
    return u.toString();
  }, [selectedLocation, displayYear, scenario, prefs]);
  // Canonical (default-pref) snapshot — powers the shared-lens banner's "standard score".
  const standardSnapshot = useMemo(() => deriveSnapshot(trajectory, year), [trajectory, year]);
  const shareStory = useMemo(() => deriveShareStory(selectedLocation, d, scoreStory, shareUrl, climateAnalog, analogCatalog, shownScenario.label, displayYear), [selectedLocation, d, scoreStory, shareUrl, climateAnalog, analogCatalog, shownScenario.label, displayYear]);

  const learningPrompts = useMemo<LearningPrompt[]>(() => deriveLearningPrompts(selectedLocation, d, scoreStory, displayYear, scenarioContrastTakeaway, scenarioContrastRows.length, climateAnalog, analogCatalog), [selectedLocation, d, scoreStory, displayYear, scenarioContrastTakeaway, scenarioContrastRows.length, climateAnalog, analogCatalog]);

  const openClimateTwinCity = () => {
    if (!climateAnalog) return;
    const c = climateAnalog.candidate;
    const loc: LocationOption = { name: `${c.name}, ${c.country}`, city: c.name, country: c.country, lat: c.lat, lng: c.lng };
    window.location.href = forecastUrl(loc, analogCatalog?.catalogYear ?? CURRENT_FORECAST_YEAR, analogCatalog?.scenario ?? DEFAULT_SCENARIO, true);
  };

  useEffect(() => {
    if (!trajectory || !selectedLocation) return;
    window.history.replaceState(null, "", forecastUrl(selectedLocation, displayYear, scenario, true));
  }, [trajectory, selectedLocation, displayYear, scenario]);

  const copyShareStory = async () => {
    if (!shareStory) return;
    await copyToClipboard(shareStory.clipboardText);
    setShareStoryCopied(true);
    window.setTimeout(() => setShareStoryCopied(false), 1800);
  };

  const downloadShareImage = async () => {
    if (!shareStory || !selectedLocation || !shareUrl) return;
    setShareImageBusy(true);
    const baseName = `fupit-share-${jsonFileSlug(selectedLocation.city || selectedLocation.name)}-${displayYear}-${scenario}`;
    const svg = buildShareImageSvg(shareStory, shareUrl);
    try {
      const png = await svgToPngBlob(svg);
      downloadBlob(png, `${baseName}.png`);
    } catch {
      downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `${baseName}.svg`);
    } finally {
      setShareImageBusy(false);
      setShareImageSaved(true);
      window.setTimeout(() => setShareImageSaved(false), 1800);
    }
  };

  const shareForecast = async () => {
    if (!selectedLocation || !shareUrl) return;
    const title = shareStory?.headline ?? `${selectedLocation.name} climate forecast to ${displayYear}`;
    const text = shareStory?.text ?? (
      d
        ? `${selectedLocation.name} in ${displayYear} under ${shownScenario.label}: ${d.avgTemp.toFixed(1)}°C average, ${d.score}/100 habitability, grounded by fupit.`
        : `Explore ${selectedLocation.name}'s grounded climate forecast to 2100 on fupit.`
    );
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
      } else {
        await copyToClipboard(shareStory?.clipboardText ?? shareUrl);
        if (shareStory) setShareStoryCopied(true);
        setShareCopied(true);
        if (shareStory) window.setTimeout(() => setShareStoryCopied(false), 1800);
        window.setTimeout(() => setShareCopied(false), 1800);
      }
    } catch {
      await copyToClipboard(shareStory?.clipboardText ?? shareUrl);
      if (shareStory) setShareStoryCopied(true);
      setShareCopied(true);
      if (shareStory) window.setTimeout(() => setShareStoryCopied(false), 1800);
      window.setTimeout(() => setShareCopied(false), 1800);
    }
  };

  const buildRawForecastJson = () => {
    if (!selectedLocation || !trajectory || !d) return "";
    return JSON.stringify({
      schema: "fupit.forecast.raw.v1",
      exported_at: new Date().toISOString(),
      location: {
        name: selectedLocation.name,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        country: selectedLocation.country,
      },
      selected_year: displayYear,
      scenario: shownScenario,
      share_url: shareUrl,
      model: {
        name: d.model,
        version: d.modelVersion,
        resolution: d.resolution,
        confidence: d.confidence,
      },
      selected_point: d.np,
      trajectory,
    }, null, 2);
  };

  const copyRawForecastJson = async () => {
    const rawJson = buildRawForecastJson();
    if (!rawJson) return;
    await copyToClipboard(rawJson);
    setRawJsonCopied(true);
    window.setTimeout(() => setRawJsonCopied(false), 1800);
  };

  const downloadRawForecastJson = () => {
    const rawJson = buildRawForecastJson();
    if (!rawJson || !selectedLocation) return;
    const blob = new Blob([rawJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fupit-forecast-${jsonFileSlug(selectedLocation.city || selectedLocation.name)}-${displayYear}-${scenario}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const buildEducationalReportMarkdown = () => {
    if (!selectedLocation || !trajectory || !d || !scoreStory) return "";
    const reportScenario = shownScenario;
    const sourceLines = d.sourceTrail
      .map((entry) => `- ${entry.label}: ${entry.source}. Method: ${entry.method}. Citation: ${entry.citation}.`)
      .join("\n");
    const roadmapLines = roadmapItems
      .map((item) => {
        const delta = item.scenarioDelta ? ` ${item.scenarioDelta}` : "";
        return `- ${item.year}: ${signedNumber(item.tempChange, 1)} C raw warming, ${item.heatDays} heat-stress days/year, ${item.coldMonths} monthly-mean freeze months, precipitation ${signedNumber(item.precipChange, 1)}%, drought ${item.drought}/100, flood ${item.flood}/100, sea-level context ${item.seaLevel} cm, habitability ${item.score}/100 (${item.category}). Main signal: ${item.driver.text}.${delta}`;
      })
      .join("\n");
    const trendLines = scoreStory.trendRates.map((rate) => `- ${rate.label}: ${rate.value}`).join("\n");
    const driverLines = scoreStory.scoreDrivers.length
      ? scoreStory.scoreDrivers.map((driver) => `- ${driver.label}: ${driver.movement}; visible score effect ${signedNumber(driver.effect, 1)} points.`).join("\n")
      : "- No single score component moved enough to dominate this horizon.";
    const dailyLifeLines = dailyLifeSignals
      .map((signal) => `- ${signal.label} (${signal.value}): ${signal.text} Receipt: ${signal.receipt}`)
      .join("\n");
    const twinLine = climateAnalog
      ? `${climateAnalog.candidate.name}, ${climateAnalog.candidate.country}; distance ${climateAnalog.distance.toFixed(2)} standardized climate units across ${climateAnalog.comparedCount} bounded-catalog cities. Temperature gap ${signedNumber(climateAnalog.annualTempDelta, 1)} C, rainfall gap ${signedNumber(climateAnalog.annualPrecipDelta, 0)} mm, heat-stress gap ${signedNumber(climateAnalog.heatDaysDelta, 0)} days/year.`
      : "No climate twin is included in this export because the bounded analog catalog did not return a match.";
    const scenarioLine = scenarioContrastTakeaway
      ? scenarioContrastTakeaway.text
      : "Scenario contrast was not loaded when this report was exported.";

    return [
      "# fupit educational climate summary",
      "",
      `Exported: ${new Date().toISOString()}`,
      `Location: ${selectedLocation.name} (${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)})`,
      `Selected year: ${displayYear}`,
      `Scenario: ${reportScenario.label} (${reportScenario.id})`,
      `Default-policy note: ${DEFAULT_SCENARIO_EXPLANATION} Version: ${DEFAULT_SCENARIO_POLICY_VERSION}.`,
      `Share URL: ${shareUrl}`,
      "",
      "## Selected-year snapshot",
      "",
      `- Raw CMIP6 model-consensus annual temperature: ${d.avgTemp.toFixed(1)} C; raw warming from ${BASELINE_YEAR}: ${signedNumber(d.tempChange, 1)} C.`,
      `- IPCC-assessed/calibrated annual temperature: ${d.ipccTemp.toFixed(1)} C; assessed anomaly ${signedNumber(d.ipccDelta, 1)} C; visible adjustment ${signedNumber(d.ipccAdjustment, 1)} C.`,
      `- Annual precipitation: ${d.annualPrecip} mm; change ${signedNumber(d.precipChange, 1)}%.`,
      `- Heat stress: ${d.heatDays} days/year.`,
      `- Cold-season context: ${d.coldMonthCount} monthly-mean freeze months; baseline ${d.baselineColdMonthCount}; coldest modeled month ${MONTHS[d.minIdx]} ${d.monthlyTemps[d.minIdx].toFixed(1)} C. This is not daily freeze days or a daily cold-stress count.`,
      `- Drought pressure: ${d.drought}/100; flood/heavy-rain pressure: ${d.flood}/100.`,
      `- Sea-level context: ${d.seaLevel} cm; range ${d.seaLow != null && d.seaHigh != null ? `${Math.round(d.seaLow)}-${Math.round(d.seaHigh)} cm` : "not exposed"}. Coastal relevance: ${coastalRelevance?.label ?? "not evaluated"}. ${coastalRelevance?.receipt ?? "No local coastal exposure inference is made."}`,
      `- Habitability presentation score: ${d.score}/100 (${d.category}); score movement from ${scoreStory.baselineYear}: ${signedNumber(scoreStory.scoreDelta, 0)} points.`,
      "",
      "## Trend rates",
      "",
      trendLines,
      "",
      "## Main score drivers",
      "",
      driverLines,
      "",
      "## Living-conditions interpretation",
      "",
      dailyLifeLines,
      "",
      "## Annual roadmap",
      "",
      roadmapLines,
      "",
      "## Scenario contrast",
      "",
      scenarioLine,
      "",
      "## Climate twin",
      "",
      twinLine,
      "",
      "## Sources and methods",
      "",
      sourceLines,
      "",
      "## What this does not mean",
      "",
      "This is educational and research context, not a property-risk certificate, safety forecast, relocation recommendation, insurance model, medical advice, engineering assessment, or guarantee that this exact point will be livable or unlivable. Local adaptation, governance, health systems, wealth, migration, conflict, infrastructure, elevation, and parcel-scale exposure are outside this score.",
      "",
      "Not yet included in the score: daily cold-stress days, crop yields, wildfire weather, biodiversity species ranges, local freshwater infrastructure, or parcel-level flood exposure.",
      "",
      "This Markdown report uses only fields already visible in the forecast page or projection receipt. It adds no unregistered enrichment layer and makes no safe-city or climate-haven claim.",
      "",
    ].join("\n");
  };

  const downloadEducationalReport = () => {
    const report = buildEducationalReportMarkdown();
    if (!report || !selectedLocation) return;
    downloadBlob(
      new Blob([report], { type: "text/markdown;charset=utf-8" }),
      `fupit-educational-summary-${jsonFileSlug(selectedLocation.city || selectedLocation.name)}-${displayYear}-${scenario}.md`,
    );
    setReportSaved(true);
    window.setTimeout(() => setReportSaved(false), 1800);
  };

  const sc = d ? scoreColor(d.score) : GREEN;
  const tPct = ((year - BASELINE_YEAR) / (MAX_YEAR - BASELINE_YEAR)) * 100;
  const maxBreakdown = d ? Math.max(...d.breakdown.map((b) => Math.abs(b.val)), 1) : 1;

  return {
  locationText, setLocationText, selectedLocation, setSelectedLocation,
  suggestions, showSuggestions, setShowSuggestions, year, scenario, trajectory, freshwater, fireWeather, floodRiver, cropYield, coverage, amoc,
  birthYear, setBirthYear, prefs, setPrefs, scoredTrajectory, standardSnapshot,
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
  };
}

export type ClimateAppVM = ReturnType<typeof useClimateApp>;
