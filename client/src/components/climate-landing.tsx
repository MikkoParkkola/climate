import { useState } from "react";
import { GitCompare, Loader2, Search, MapPin } from "lucide-react";
import {
  ACCENT, BORDER, CARD, MUTED, RED, SCENARIOS, DEFAULT_SCENARIO,
  DEFAULT_SCENARIO_EXPLANATION, DEFAULT_SCENARIO_POLICY_VERSION, scenarioOptionLabel,
  CURRENT_POLICIES_BAND,
  CHECKPOINTS, BASELINE_YEAR, CURRENT_FORECAST_YEAR, MAX_YEAR,
} from "@/lib/climate-constants";
import { parseScenario } from "@/lib/climate-helpers";
import type { LocationOption, ScenarioId } from "@/lib/climate-types";
import { ReceiptDetails } from "@/components/climate-charts";
import { Term } from "@/components/climate-term";
import { useBirthYear } from "@/lib/use-birth-year";

export default function ClimateLanding({
  locationText, setLocationText, setSelectedLocation, suggestions, showSuggestions,
  setShowSuggestions, selectLocation, scenario, changeScenario, isLoading,
  selectedScenario, generate, loadingStep, error,
}: {
  locationText: string;
  setLocationText: (v: string) => void;
  setSelectedLocation: (v: LocationOption | null) => void;
  suggestions: LocationOption[];
  showSuggestions: boolean;
  setShowSuggestions: (v: boolean) => void;
  selectLocation: (opt: LocationOption) => void;
  scenario: ScenarioId;
  changeScenario: (next: ScenarioId) => void;
  isLoading: boolean;
  selectedScenario: { id: ScenarioId; short: string; label: string; caption: string };
  generate: (locationOverride?: LocationOption) => void;
  loadingStep: number;
  error: string | null;
}) {
  const currentYear = new Date().getFullYear();
  const [birthYear, setBirthYear] = useBirthYear();
  const [geoBusy, setGeoBusy] = useState(false);
  // "Use my location" — browser geolocation (explicit consent, precise). Only the
  // coordinates leave the browser; the city name is resolved on our server, so the
  // user's IP is never handed to a geocoder.
  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let option: LocationOption = {
          name: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`, lat: latitude, lng: longitude, country: "", city: "Your location",
        };
        try {
          const resp = await fetch(`/api/locations/reverse?lat=${latitude.toFixed(4)}&lng=${longitude.toFixed(4)}`);
          const loc = await resp.json();
          if (loc?.name) option = { name: loc.name, lat: loc.lat ?? latitude, lng: loc.lng ?? longitude, country: loc.country ?? "", city: String(loc.name).split(",")[0] };
        } catch { /* coordinates still drive the forecast */ }
        setGeoBusy(false);
        selectLocation(option);
        generate(option);
      },
      () => setGeoBusy(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };
  return (
    <div className="fupit-landing">
      <header style={{ background: "hsl(222,16%,9%)", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href="/" aria-label="fupit home" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit", cursor: "pointer" }}>
              <img src="/favicon.svg" alt="" width={30} height={30} style={{ width: 30, height: 30, borderRadius: 7, display: "block" }} />
              <span style={{ fontWeight: 700, fontSize: 17 }}>fupit</span>
            </a>
          </div>
          <button onClick={() => (window.location.href = "/comparison")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 7, border: `1px solid ${BORDER}`, background: CARD, color: "white", fontSize: 13, cursor: "pointer" }}>
            <GitCompare style={{ width: 15, height: 15 }} />
            <span>Compare Locations</span>
          </button>
        </div>
      </header>

      <main className="fupit-landing-main">
        <div className="fupit-landing-content">
          <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: 20, border: `1px solid ${BORDER}`, background: CARD, fontSize: 11, color: ACCENT, marginBottom: 20, letterSpacing: "0.05em" }}>
            CMIP6 · IPCC AR6 · NASA Sea Level
          </div>
          <h1 className="fupit-landing-title">
            Everywhere's getting worse.<br />Just not equally.
          </h1>
          <p className="fupit-landing-copy" style={{ fontSize: 15, color: MUTED, marginBottom: 32, lineHeight: 1.6 }}>
            Watch any place on Earth heat up, year by year from now to 2100, and compare them side by side to find where stays livable long enough to matter. Where do you want to grow old? Where will your kids?
          </p>

          <button type="button" onClick={useMyLocation} disabled={geoBusy}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "6px 11px", borderRadius: 999, border: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.04)", color: geoBusy ? MUTED : ACCENT, fontSize: 12, cursor: geoBusy ? "wait" : "pointer" }}>
            {geoBusy ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> : <MapPin style={{ width: 13, height: 13 }} />}
            {geoBusy ? "Locating…" : "Use my location"}
          </button>

          <div className="location-input-container" style={{ position: "relative", textAlign: "left" }}>
            <div style={{ position: "relative" }}>
              <Search style={{ width: 18, height: 18, color: MUTED, position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
              <input
                value={locationText}
                onChange={(e) => { setLocationText(e.target.value); setSelectedLocation(null); }}
                onFocus={() => { if (suggestions.length) setShowSuggestions(true); }}
                placeholder="Search a city or place — e.g. Amsterdam"
                style={{ width: "100%", padding: "14px 14px 14px 44px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.05)", color: "white", fontSize: 15, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "hsl(222,15%,13%)", border: `1px solid ${BORDER}`, borderRadius: 6, overflow: "hidden", zIndex: 20 }}>
                {suggestions.slice(0, 6).map((s, i) => (
                  <div key={i} onClick={() => selectLocation(s)}
                    style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", borderBottom: i < Math.min(suggestions.length, 6) - 1 ? `1px solid ${BORDER}` : "none" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <MapPin style={{ width: 15, height: 15, color: ACCENT, flexShrink: 0 }} />
                    <span style={{ fontSize: 14 }}>{s.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Optional age — client-side only, powers the personal-lifetime framing */}
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
            <label htmlFor="age-input" style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>Your age</label>
            <input
              id="age-input"
              type="number"
              min={1}
              max={119}
              inputMode="numeric"
              value={birthYear ? String(currentYear - birthYear) : ""}
              onChange={(e) => {
                const a = Number(e.target.value);
                setBirthYear(Number.isFinite(a) && a > 0 && a < 120 ? currentYear - a : null);
              }}
              placeholder="optional"
              style={{ flex: "0 0 88px", border: `1px solid ${BORDER}`, borderRadius: 7, background: "rgba(255,255,255,0.05)", color: "white", padding: "7px 9px", fontSize: 13, outline: "none" }}
            />
            <span style={{ color: MUTED, fontSize: 12, lineHeight: 1.35 }}>
              See the forecast against your own lifetime. Stays in your browser. Never sent anywhere.
            </span>
          </div>

          {/* Scenario lives behind a disclosure: sensible default, no clutter on the main view */}
          <details style={{ marginTop: 12, textAlign: "left" }}>
            <summary style={{ cursor: "pointer", fontSize: 12, color: MUTED }}>
              Options — forecasting on the {selectedScenario.short} ({selectedScenario.label}){" "}
              <Term k="emissions_scenario">emissions path</Term> by default
            </summary>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, border: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.035)" }}>
              <label htmlFor="scenario-select" style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
                <Term k="emissions_scenario">Scenario</Term>
              </label>
              <select
                id="scenario-select"
                value={scenario}
                onChange={(e) => changeScenario(parseScenario(e.target.value))}
                disabled={isLoading}
                style={{ flex: "0 0 132px", border: `1px solid ${BORDER}`, borderRadius: 7, background: "rgba(8,11,18,0.94)", color: "white", padding: "7px 9px", fontSize: 13, fontWeight: 700, outline: "none" }}
              >
                {SCENARIOS.map((s) => <option key={s.id} value={s.id} title={s.realism}>{scenarioOptionLabel(s)}</option>)}
              </select>
              <span style={{ color: MUTED, fontSize: 12, lineHeight: 1.35 }}>
                {selectedScenario.caption} The shared forecast URL keeps this scenario.
              </span>
              {scenario === DEFAULT_SCENARIO && (
                <ReceiptDetails label="why default" text={`${DEFAULT_SCENARIO_EXPLANATION} Version: ${DEFAULT_SCENARIO_POLICY_VERSION}.`} />
              )}
              <ReceiptDetails label="current policies" text={CURRENT_POLICIES_BAND} />
            </div>
          </details>

          <button
            onClick={() => generate()}
            disabled={isLoading}
            style={{
              marginTop: 16, width: "100%", padding: "14px", borderRadius: 10, border: "none", fontSize: 15, fontWeight: 700,
              cursor: isLoading ? "wait" : "pointer",
              background: "linear-gradient(135deg, hsl(24,88%,56%) 0%, hsl(12,80%,50%) 100%)",
              color: "white",
              opacity: isLoading ? 0.72 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
            {isLoading ? <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> : null}
            {isLoading ? "Generating forecast" : "See climate forecast →"}
          </button>

          {isLoading && (
            <div style={{ marginTop: 18, fontSize: 13, color: MUTED }}>
              Sampling grounded CMIP6/IPCC grid — 5-year checkpoint {Math.min(loadingStep + 1, CHECKPOINTS.length)}/{CHECKPOINTS.length} ({CHECKPOINTS[loadingStep]})
              <div style={{ marginTop: 10, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", background: ACCENT, borderRadius: 2, width: `${((loadingStep + 1) / CHECKPOINTS.length) * 100}%`, transition: "width 0.4s ease" }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Sampling {BASELINE_YEAR} as the comparison point, {CURRENT_FORECAST_YEAR} as the current start, then every 5 years to {MAX_YEAR}; packed scenario layers start at 2030.</div>
            </div>
          )}
          {error && <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: `${RED}14`, border: `1px solid ${RED}30`, color: "#fca5a5", fontSize: 13 }}>{error}</div>}
        </div>
      </main>

      {/* What you'll see — plain-language tour of every signal, so the landing page
          actually names the full feature set. Each term is tap/hover-to-explain. */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "8px 20px 40px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, textAlign: "center" }}>What you'll see for any place</h2>
        <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6, marginBottom: 22, textAlign: "center", maxWidth: 640, marginLeft: "auto", marginRight: "auto" }}>
          Pick a place and you get a forecast to 2100 built only from real climate science. Hover or tap any blue-dotted word to see what it means in plain English. Here's everything we show:
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {[
            { t: <>Temperature & rainfall</>, d: <>How hot and how wet it gets, month by month, with the <Term k="anomaly">change from today</Term>.</> },
            { t: <><Term k="heat_stress_day">Heat</Term> & <Term k="humid_heat_days">humid heat</Term></>, d: <>Dangerously hot days, and the <Term k="wet_bulb">wet-bulb</Term> days when humidity stops your body cooling down.</> },
            { t: <><Term k="fire_weather">Fire weather</Term></>, d: <>How many days a year have weather dry and hot enough for wildfires to spread fast.</> },
            { t: <><Term k="river_flood">Floods</Term> & heavy rain</>, d: <>The risk of intense downpours and how much nearby land sits in a big river flood's path.</> },
            { t: <><Term k="water_stress">Freshwater</Term></>, d: <>Whether the region is running short of water as demand creeps up on supply.</> },
            { t: <><Term k="crop_yield">Crops</Term></>, d: <>Whether staple harvests like wheat and maize grow better or worse here over time.</> },
            { t: <><Term k="cold_season">Cold season</Term></>, d: <>How many <Term k="frost_days">frost days</Term> a winter still has as the climate warms.</> },
            { t: <>Energy & <Term k="degree_days">degree-days</Term></>, d: <>Roughly how much heating and air-conditioning a place needs across the year.</> },
            { t: <><Term k="sea_level_rise">Sea level</Term></>, d: <>How much the ocean rises near the coast — background context if you're inland.</> },
            { t: <><Term k="amoc">AMOC / Gulf Stream</Term></>, d: <>For NW Europe and the North Atlantic: the ocean current that could cool the region even as the planet warms.</> },
            { t: <><Term k="habitability_score">Habitability score</Term></>, d: <>One 0–100 number blending comfort, water and hazards, so you can compare places fast.</> },
            { t: <><Term k="emissions_scenario">Emissions paths</Term></>, d: <>See the future on four "what if" paths, from fast cuts (<Term k="ssp126">SSP1-2.6</Term>) to worst case (<Term k="ssp585">SSP5-8.5</Term>).</> },
          ].map((f, i) => (
            <div key={i} style={{ border: `1px solid ${BORDER}`, background: CARD, borderRadius: 10, padding: "13px 14px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{f.t}</div>
              <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>{f.d}</div>
            </div>
          ))}
        </div>
        <p style={{ color: MUTED, fontSize: 11.5, lineHeight: 1.6, marginTop: 18, textAlign: "center" }}>
          Every number traces to a real source (<Term k="cmip6">CMIP6</Term>, <Term k="ipcc">IPCC AR6</Term>, NASA and others). If we can't ground a value, we leave it blank instead of guessing — see the{" "}
          <a href="/methodology" style={{ color: ACCENT, textDecoration: "underline", textUnderlineOffset: 2 }}>methodology</a>.
        </p>
      </section>

      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: "16px 20px", textAlign: "center" }}>
        <p style={{ color: MUTED, fontSize: 10 }}>
          © {new Date().getFullYear()}{" "}
          <a href="https://github.com/MikkoParkkola" target="_blank" rel="noopener noreferrer" style={{ color: MUTED, textDecoration: "underline", textUnderlineOffset: 2 }}>
            Mikko Parkkola
          </a>{" "}
          · fupit
        </p>
      </footer>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
