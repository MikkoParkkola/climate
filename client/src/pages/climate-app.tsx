import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Thermometer, Droplets, MapPin, TrendingUp, AlertTriangle,
  Waves, Cloud, FileText, Globe, Award, CheckCircle,
  GitCompare, Loader2, Wind, BarChart2, Activity
} from "lucide-react";
import LivabilityIndexBreakdown from "@/components/livability-index-breakdown";
import HabitabilityRanking from "@/components/habitability-ranking-refactored";
import GlobalRankingDisplay from "@/components/global-ranking-display";

interface LocationOption {
  name: string;
  lat: number;
  lng: number;
  country: string;
  city: string;
  state: string;
}

function HabitabilityBadge({ score }: { score: number }) {
  if (score >= 80) return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border">Excellent</Badge>;
  if (score >= 60) return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 border">Good</Badge>;
  if (score >= 40) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border">Fair</Badge>;
  if (score >= 20) return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 border">Poor</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border">Severe</Badge>;
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "#34d399" : score >= 60 ? "#60a5fa" : score >= 40 ? "#facc15" : score >= 20 ? "#fb923c" : "#f87171";
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="110" height="110" className="-rotate-90">
        <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
        <circle
          cx="55" cy="55" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-white leading-none">{score.toFixed(0)}</span>
        <span className="text-xs text-slate-400 mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

export default function ClimateApp() {
  const [location, setLocation] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationOption[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [year, setYear] = useState(2050);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [climateData, setClimateData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.location-input-container')) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (location.length < 2) { setLocationSuggestions([]); setShowSuggestions(false); return; }
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/locations/search?q=${encodeURIComponent(location)}`);
        const suggestions = await response.json();
        setLocationSuggestions(suggestions);
        setShowSuggestions(true);
      } catch (err) {
        console.warn("Location search failed:", err);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [location]);

  const selectLocation = (opt: LocationOption) => {
    setSelectedLocation(opt);
    setLocation(opt.name);
    setShowSuggestions(false);
  };

  const handleSubmit = async () => {
    if (!selectedLocation) { setError("Please select a location from the suggestions."); return; }
    setError(null);
    setIsLoading(true);
    setClimateData(null);
    setStatusMessage("Connecting to climate model...");
    try {
      setStatusMessage("Running CBottle ICON atmospheric model...");
      const response = await fetch("/api/climate-projection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: selectedLocation.name, coordinates: { lat: selectedLocation.lat, lng: selectedLocation.lng }, year })
      });
      setStatusMessage("Processing climate projection data...");
      const data = await response.json();
      if (data.success && data.data) {
        setClimateData(data.data);
        setStatusMessage(null);
      } else {
        setError(data.error || "Projection failed. Please try again.");
      }
    } catch (err) {
      setError("Network error. Please check your connection.");
    } finally {
      setIsLoading(false);
      setStatusMessage(null);
    }
  };

  const exportToPDF = async () => {
    if (!climateData) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).jsPDF;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 10;
      let y = margin;

      pdf.setFontSize(20); pdf.setFont('helvetica', 'bold');
      pdf.text('Climate Projection Report', pageWidth / 2, y + 10, { align: 'center' });
      y += 20;
      pdf.setFontSize(14); pdf.setFont('helvetica', 'normal');
      pdf.text(`Location: ${climateData.location?.name || 'Unknown'}`, pageWidth / 2, y, { align: 'center' });
      y += 10;
      pdf.text(`Projection Year: ${climateData.year}`, pageWidth / 2, y, { align: 'center' });
      y += 10;
      pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, y, { align: 'center' });
      y += 20;
      if (climateData.temperature) {
        pdf.setFontSize(12);
        pdf.text(`Annual Mean Temperature: ${climateData.temperature.annual_mean?.toFixed(1)}°C`, margin, y); y += 8;
        pdf.text(`Temperature Change: +${climateData.temperature.anomaly?.toFixed(1)}°C`, margin, y); y += 8;
        pdf.text(`Range: ${climateData.temperature.min?.toFixed(1)}°C to ${climateData.temperature.max?.toFixed(1)}°C`, margin, y); y += 12;
      }
      if (climateData.precipitation) {
        pdf.text(`Annual Precipitation: ${climateData.precipitation.annual_total?.toFixed(0)} mm`, margin, y); y += 8;
        pdf.text(`Precipitation Change: ${climateData.precipitation.anomaly_percent > 0 ? '+' : ''}${climateData.precipitation.anomaly_percent?.toFixed(1)}%`, margin, y); y += 12;
      }
      if (climateData.habitability) {
        pdf.text(`Habitability Score: ${climateData.habitability.score?.toFixed(1)}/100 (${climateData.habitability.category})`, margin, y); y += 12;
      }
      const fileName = `Climate_Report_${climateData.location?.name?.replace(/[^a-zA-Z0-9]/g, '_')}_${climateData.year}.pdf`;
      pdf.save(fileName);
    } catch {
      const reportContent = `CLIMATE PROJECTION REPORT\nLocation: ${climateData.location?.name}\nYear: ${climateData.year}\nTemp: ${climateData.temperature?.annual_mean?.toFixed(1)}°C\nPrecip: ${climateData.precipitation?.annual_total?.toFixed(0)}mm\nHabitability: ${climateData.habitability?.score?.toFixed(0)}/100`;
      const blob = new Blob([reportContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `Climate_Report_${climateData.location?.name?.replace(/[^a-zA-Z0-9]/g, '_')}_${climateData.year}.txt`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
    }
  };

  const habitScore = climateData?.habitability?.score ?? 0;
  const tempMean = climateData?.temperature?.annual_mean;
  const precip = climateData?.precipitation?.annual_total;

  return (
    <div className="min-h-screen" style={{ background: "hsl(222, 47%, 8%)" }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b" style={{ background: "hsla(222,47%,8%,0.9)", backdropFilter: "blur(16px)", borderColor: "hsl(217,33%,18%)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(192,91%,36%) 0%, hsl(215,91%,50%) 100%)" }}>
              <Globe className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white text-lg tracking-tight">ClimateVision</span>
            <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "hsla(192,91%,46%,0.15)", color: "hsl(192,91%,60%)", border: "1px solid hsla(192,91%,46%,0.25)" }}>
              CBottle/ICON Model
            </span>
          </div>
          <div className="flex items-center gap-3">
            {climateData && (
              <Button onClick={exportToPDF} size="sm" variant="ghost" className="gap-2 text-slate-400 hover:text-white hover:bg-white/5">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Export PDF</span>
              </Button>
            )}
            <Button
              size="sm" variant="ghost"
              onClick={() => window.location.href = '/comparison'}
              className="gap-2 text-slate-400 hover:text-white hover:bg-white/5"
            >
              <GitCompare className="w-4 h-4" />
              <span className="hidden sm:inline">Compare</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero / Search ── */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(160deg, hsl(222,47%,9%) 0%, hsl(215,55%,11%) 50%, hsl(192,55%,9%) 100%)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 60% at 50% -20%, hsla(192,91%,46%,0.08) 0%, transparent 70%)" }} />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 relative">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              Climate Projections
              <span className="block text-gradient text-2xl sm:text-3xl mt-1">for Any Location on Earth</span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
              Explore temperature, precipitation, heat stress, and habitability forecasts powered by the CBottle atmospheric model.
            </p>
          </div>

          {/* Search card */}
          <div className="rounded-2xl p-5 sm:p-6 shadow-2xl" style={{ background: "hsl(222,47%,12%)", border: "1px solid hsl(217,33%,22%)" }}>
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Location input */}
              <div className="relative location-input-container flex-1">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <MapPin className="w-4 h-4 text-slate-500" />
                </div>
                <Input
                  placeholder="Search for a city or location..."
                  value={location}
                  onChange={(e) => { setLocation(e.target.value); setSelectedLocation(null); }}
                  onFocus={() => { if (locationSuggestions.length > 0) setShowSuggestions(true); }}
                  className="pl-9 h-11 text-sm rounded-xl"
                  style={{ background: "hsl(222,47%,9%)", borderColor: "hsl(217,33%,25%)", color: "white" }}
                />
                {showSuggestions && locationSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto" style={{ background: "hsl(222,47%,13%)", border: "1px solid hsl(217,33%,25%)" }}>
                    {locationSuggestions.map((s, i) => (
                      <div key={i} onClick={() => selectLocation(s)}
                        className="px-4 py-3 cursor-pointer flex items-start gap-3 hover:bg-white/5 transition-colors border-b last:border-b-0"
                        style={{ borderColor: "hsl(217,33%,20%)" }}>
                        <MapPin className="w-3.5 h-3.5 text-cyan-500 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-white">{s.city || s.name.split(',')[0]}</div>
                          <div className="text-xs text-slate-500 truncate">{s.name}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedLocation && (
                  <div className="absolute -bottom-5 left-0 text-xs text-cyan-500 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    {selectedLocation.city || selectedLocation.name.split(',')[0]}, {selectedLocation.country}
                  </div>
                )}
              </div>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={isLoading || !selectedLocation}
                className="h-11 px-6 rounded-xl font-semibold text-sm shrink-0"
                style={{ background: isLoading || !selectedLocation ? "hsl(217,33%,22%)" : "linear-gradient(135deg, hsl(192,91%,40%) 0%, hsl(215,91%,55%) 100%)", color: isLoading || !selectedLocation ? "hsl(215,20%,45%)" : "white", border: "none" }}
              >
                {isLoading ? <><Loader2 className="w-4 h-4 mr-2 spin" />Analyzing...</> : "Generate Projection"}
              </Button>
            </div>

            {/* Year selector */}
            <div className="mt-5 pt-5" style={{ borderTop: "1px solid hsl(217,33%,20%)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Projection Year</span>
                <span className="text-lg font-bold text-white">{year}</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {[2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100].map((d) => (
                  <button key={d} onClick={() => setYear(d)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                    style={{
                      background: year === d ? "hsla(192,91%,46%,0.2)" : "hsl(222,47%,9%)",
                      color: year === d ? "hsl(192,91%,60%)" : "hsl(215,20%,55%)",
                      border: `1px solid ${year === d ? "hsla(192,91%,46%,0.4)" : "hsl(217,33%,22%)"}`
                    }}>
                    {d}
                  </button>
                ))}
              </div>
              <Slider value={[year]} onValueChange={(v) => setYear(v[0])} min={2025} max={2100} step={1} className="w-full" />
            </div>

            {/* Status / Error */}
            {error && (
              <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: "hsla(0,84%,60%,0.1)", border: "1px solid hsla(0,84%,60%,0.25)", color: "hsl(0,84%,72%)" }}>
                <AlertTriangle className="w-4 h-4 shrink-0" />{error}
              </div>
            )}
            {isLoading && statusMessage && (
              <div className="mt-4 status-bar animate-fade-in">
                <Loader2 className="w-4 h-4 spin shrink-0" />
                {statusMessage}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Loading skeleton ── */}
      {isLoading && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
          </div>
          <div className="skeleton h-48 rounded-2xl" />
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="skeleton h-64 rounded-2xl" />
            <div className="skeleton h-64 rounded-2xl" />
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && !climateData && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6" style={{ background: "hsl(222,47%,13%)", border: "1px solid hsl(217,33%,22%)" }}>
            <Globe className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Search for a location to get started</h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Type any city name, select it from the suggestions, choose your target year, and click Generate Projection.
          </p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
            {[
              { icon: Thermometer, title: "Temperature", desc: "Monthly profiles and annual mean temperature projections" },
              { icon: Droplets, title: "Precipitation", desc: "Rainfall patterns, seasonal distribution and drought risk" },
              { icon: Award, title: "Habitability", desc: "Comprehensive score combining all climate factors" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl p-4" style={{ background: "hsl(222,47%,12%)", border: "1px solid hsl(217,33%,20%)" }}>
                <Icon className="w-5 h-5 mb-2" style={{ color: "hsl(192,91%,50%)" }} />
                <div className="text-sm font-medium text-white mb-1">{title}</div>
                <div className="text-xs text-slate-500">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {!isLoading && climateData && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fade-in">

          {/* ── KPI strip ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Temperature */}
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "hsla(0,84%,60%,0.15)" }}>
                  <Thermometer className="w-4 h-4" style={{ color: "hsl(0,84%,65%)" }} />
                </div>
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Temperature</span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {tempMean?.toFixed(1)}<span className="text-lg text-slate-400">°C</span>
              </div>
              <div className="text-xs text-slate-500">
                {climateData.temperature?.anomaly > 0 ? "+" : ""}{climateData.temperature?.anomaly?.toFixed(1)}°C vs baseline
              </div>
            </div>

            {/* Precipitation */}
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "hsla(207,90%,54%,0.15)" }}>
                  <Droplets className="w-4 h-4" style={{ color: "hsl(207,90%,65%)" }} />
                </div>
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Precipitation</span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {precip?.toFixed(0)}<span className="text-lg text-slate-400"> mm</span>
              </div>
              <div className="text-xs text-slate-500">
                {climateData.precipitation?.anomaly_percent > 0 ? "+" : ""}{climateData.precipitation?.anomaly_percent?.toFixed(1)}% vs baseline
              </div>
            </div>

            {/* Heat Stress */}
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "hsla(24,92%,60%,0.15)" }}>
                  <Activity className="w-4 h-4" style={{ color: "hsl(24,92%,65%)" }} />
                </div>
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Heat Stress</span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {climateData.extremes?.heat_stress_days ?? 0}<span className="text-lg text-slate-400"> days</span>
              </div>
              <div className="text-xs text-slate-500">Days above 35°C per year</div>
            </div>

            {/* Habitability */}
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "hsla(142,76%,45%,0.15)" }}>
                  <Award className="w-4 h-4" style={{ color: "hsl(142,76%,55%)" }} />
                </div>
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Habitability</span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {habitScore.toFixed(0)}<span className="text-lg text-slate-400">/100</span>
              </div>
              <HabitabilityBadge score={habitScore} />
            </div>
          </div>

          {/* ── Location header ── */}
          <div className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4" style={{ background: "hsl(222,47%,12%)", border: "1px solid hsl(217,33%,22%)" }}>
            <div className="flex items-center gap-4 flex-1">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "hsla(192,91%,46%,0.12)", border: "1px solid hsla(192,91%,46%,0.2)" }}>
                <MapPin className="w-6 h-6" style={{ color: "hsl(192,91%,56%)" }} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">{climateData.location?.name}</h2>
                <p className="text-sm text-slate-400">
                  {climateData.location?.latitude?.toFixed(4)}°, {climateData.location?.longitude?.toFixed(4)}° · {climateData.location?.climate_zone} Climate Zone
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <span className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "hsla(192,91%,46%,0.1)", color: "hsl(192,91%,65%)", border: "1px solid hsla(192,91%,46%,0.2)" }}>
                Projection: {climateData.year}
              </span>
              <span className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "hsl(222,47%,9%)", color: "hsl(215,20%,55%)", border: "1px solid hsl(217,33%,22%)" }}>
                {climateData.metadata?.model}
              </span>
            </div>
          </div>

          {/* ── Satellite Map ── */}
          <div className="section-card">
            <div className="section-header">
              <MapPin className="w-5 h-5" style={{ color: "hsl(192,91%,56%)" }} />
              <h3 className="font-semibold text-white">Location Overview</h3>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-xl overflow-hidden border aspect-video" style={{ borderColor: "hsl(217,33%,22%)" }}>
                  <iframe
                    src={`https://maps.google.com/maps?q=${climateData.location?.latitude},${climateData.location?.longitude}&t=k&z=10&ie=UTF8&iwloc=&output=embed`}
                    width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade" title="Satellite View"
                  />
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl p-4" style={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,20%)" }}>
                    <h4 className="text-sm font-medium text-slate-300 mb-3">Geographic Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Location</span><span className="text-white font-medium">{climateData.location?.name}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Coordinates</span><span className="text-white font-mono text-xs">{climateData.location?.latitude?.toFixed(4)}°, {climateData.location?.longitude?.toFixed(4)}°</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Climate Zone</span><span className="text-white">{climateData.location?.climate_zone}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Target Year</span><span className="text-white">{climateData.year}</span></div>
                    </div>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,20%)" }}>
                    <h4 className="text-sm font-medium text-slate-300 mb-2">Atmospheric Pattern</h4>
                    <p className="text-sm text-slate-400">{climateData.atmospheric_physics?.circulation_pattern}</p>
                    <p className="text-xs mt-1" style={{ color: "hsl(192,91%,60%)" }}>Sensitivity: {climateData.atmospheric_physics?.climate_sensitivity}× global average</p>
                  </div>
                </div>
              </div>

              {/* Adaptation analysis */}
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Challenges */}
                {(() => {
                  const challenges: any[] = [];
                  const tempChange = climateData.temperature_change || 0;
                  const precipChange = climateData.precipitation_change || 0;
                  const latitude = climateData.location?.latitude || 0;
                  const coastal = Math.abs(latitude) < 60 && climateData.sea_level_rise > 0;
                  const habitScore = climateData.habitability?.score || 0;

                  if (tempChange > 3) challenges.push({ issue: "Extreme Heat Stress", description: `${tempChange.toFixed(1)}°C warming creates dangerous heat conditions`, impact: "HIGH", magnitude: "85-95% increase in heat days" });
                  else if (tempChange > 1.5) challenges.push({ issue: "Rising Temperature Discomfort", description: `${tempChange.toFixed(1)}°C warming affects daily comfort`, impact: "MEDIUM", magnitude: "40-60% increase in uncomfortable days" });
                  if (precipChange < -20) challenges.push({ issue: "Severe Drought Risk", description: `${Math.abs(precipChange).toFixed(0)}% precipitation decline threatens water security`, impact: "HIGH", magnitude: "60-80% higher drought frequency" });
                  else if (precipChange > 25) challenges.push({ issue: "Increased Flood Risk", description: `${precipChange.toFixed(0)}% more precipitation increases flooding`, impact: "MEDIUM-HIGH", magnitude: "50-70% more flood events" });
                  if (latitude > 55) challenges.push({ issue: "Arctic Climate Instability", description: "High-latitude regions face rapid climate shifts", impact: "MEDIUM", magnitude: "2-3x faster warming than global average" });
                  if (coastal) challenges.push({ issue: "Sea Level Rise Impact", description: `${climateData.sea_level_rise}cm rise threatens coastal infrastructure`, impact: "MEDIUM-HIGH", magnitude: "30-50% of coastal areas at risk" });
                  if (tempChange > 2 || Math.abs(precipChange) > 20) challenges.push({ issue: "Infrastructure Adaptation Costs", description: "Existing infrastructure needs climate-proofing", impact: "MEDIUM", magnitude: "15-25% increase in maintenance costs" });
                  if (challenges.length < 2 && latitude > 45 && latitude < 60) {
                    challenges.push({ issue: "European Climate Transition", description: "Western Europe faces shifting precipitation patterns and increasing weather variability", impact: "MEDIUM", magnitude: "20-30% increase in weather extremes" });
                    challenges.push({ issue: "Urban Heat Island Effect", description: "Cities experience amplified warming compared to rural areas", impact: "MEDIUM", magnitude: "2-5°C additional warming in urban centers" });
                  }
                  challenges.push({ issue: "Economic Adaptation Costs", description: "Regional economy needs investment in climate resilience", impact: "MEDIUM", magnitude: "5-15% of regional GDP for adaptation" });

                  return (
                    <div className="rounded-xl p-4" style={{ background: "hsla(0,84%,60%,0.06)", border: "1px solid hsla(0,84%,60%,0.2)" }}>
                      <h5 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "hsl(0,84%,70%)" }}>
                        <AlertTriangle className="w-4 h-4" />Key Challenges
                      </h5>
                      <div className="space-y-3">
                        {challenges.slice(0, 4).map((c, i) => (
                          <div key={i} className="pl-3 border-l-2" style={{ borderColor: c.impact === "HIGH" ? "hsl(0,84%,60%)" : "hsl(24,92%,55%)" }}>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium text-white">{c.issue}</span>
                              <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: c.impact === "HIGH" ? "hsla(0,84%,60%,0.2)" : "hsla(24,92%,60%,0.2)", color: c.impact === "HIGH" ? "hsl(0,84%,70%)" : "hsl(24,92%,70%)" }}>{c.impact}</span>
                            </div>
                            <p className="text-xs text-slate-500">{c.description}</p>
                            <p className="text-xs font-medium mt-0.5" style={{ color: "hsl(24,92%,65%)" }}>Impact: {c.magnitude}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Opportunities */}
                {(() => {
                  const opps: any[] = [];
                  const tempChange = climateData.temperature_change || 0;
                  const precipChange = climateData.precipitation_change || 0;
                  const latitude = climateData.location?.latitude || 0;
                  const habitScore = climateData.habitability?.score || 0;
                  if (latitude > 55) opps.push({ advantage: "Climate Refuge Potential", description: "High-latitude location offers relative climate stability", impact: "HIGH", magnitude: "2-3x better than equatorial regions" });
                  if (tempChange > 0 && tempChange < 3 && latitude > 50) opps.push({ advantage: "Extended Growing Season", description: `${tempChange.toFixed(1)}°C warming extends agricultural potential`, impact: "MEDIUM", magnitude: "20-40% longer growing season" });
                  if (precipChange > -10 && precipChange < 15) opps.push({ advantage: "Stable Water Resources", description: "Minimal precipitation change maintains water security", impact: "MEDIUM-HIGH", magnitude: "90%+ water availability maintained" });
                  if (habitScore > 45) opps.push({ advantage: "Climate Migration Destination", description: "Above-average habitability attracts climate migrants", impact: "MEDIUM", magnitude: "25-40% economic growth potential" });
                  if (latitude > 50) opps.push({ advantage: "Reduced Cooling Costs", description: "Northern location requires less air conditioning", impact: "LOW-MEDIUM", magnitude: "30-50% lower cooling energy needs" });
                  opps.push({ advantage: "Green Technology Leadership", description: "Early adaptation creates competitive advantage", impact: "MEDIUM", magnitude: "15-30% innovation economy growth" });
                  return (
                    <div className="rounded-xl p-4" style={{ background: "hsla(142,76%,45%,0.06)", border: "1px solid hsla(142,76%,45%,0.2)" }}>
                      <h5 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "hsl(142,76%,55%)" }}>
                        <CheckCircle className="w-4 h-4" />Adaptation Opportunities
                      </h5>
                      <div className="space-y-3">
                        {opps.slice(0, 4).map((o, i) => (
                          <div key={i} className="pl-3 border-l-2" style={{ borderColor: "hsl(142,76%,40%)" }}>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium text-white">{o.advantage}</span>
                              <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: "hsla(142,76%,45%,0.2)", color: "hsl(142,76%,65%)" }}>{o.impact}</span>
                            </div>
                            <p className="text-xs text-slate-500">{o.description}</p>
                            <p className="text-xs font-medium mt-0.5" style={{ color: "hsl(142,76%,55%)" }}>Benefit: {o.magnitude}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="mt-4 rounded-xl p-4" style={{ background: "hsla(207,90%,54%,0.06)", border: "1px solid hsla(207,90%,54%,0.2)" }}>
                <h5 className="text-sm font-semibold mb-1" style={{ color: "hsl(207,90%,65%)" }}>Comparative Global Position</h5>
                <p className="text-sm text-slate-400">
                  {(() => {
                    const score = climateData.habitability?.score || 0;
                    const latitude = climateData.location?.latitude || 0;
                    const tempChange = climateData.temperature_change || 0;
                    if (score > 60 && latitude > 50) return `This location offers significant climate advantages compared to lower-latitude regions, with ${tempChange > 0 && tempChange < 3 ? 'moderate warming that may extend growing seasons' : 'relatively stable temperature conditions'} and ${latitude > 55 ? 'potential as a climate refuge destination' : 'good adaptation prospects'}.`;
                    else if (score > 45) return `This location maintains moderate habitability compared to global averages, with ${tempChange < 2 ? 'manageable temperature changes' : 'adaptation challenges that are still addressable'} and opportunities for ${latitude > 50 ? 'northern climate advantages' : 'strategic climate planning'}.`;
                    return `This location faces significant climate adaptation challenges compared to more favorable regions, requiring ${tempChange > 3 ? 'major heat management strategies' : 'comprehensive climate resilience planning'} and ${Math.abs(climateData.precipitation_change || 0) > 20 ? 'water resource adaptation' : 'infrastructure hardening'}.`;
                  })()}
                </p>
              </div>
            </div>
          </div>

          {/* ── Location & Year cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl p-4" style={{ background: "hsl(222,47%,12%)", border: "1px solid hsla(192,91%,46%,0.2)" }}>
              <div className="flex items-center gap-2 mb-2"><MapPin className="w-4 h-4" style={{ color: "hsl(192,91%,56%)" }} /><span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Location</span></div>
              <p className="text-base font-semibold text-white">{climateData.location?.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{climateData.location?.latitude?.toFixed(4)}°, {climateData.location?.longitude?.toFixed(4)}°</p>
              <p className="text-xs mt-1 font-medium" style={{ color: "hsl(192,91%,60%)" }}>{climateData.location?.climate_zone} Climate Zone</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: "hsl(222,47%,12%)", border: "1px solid hsla(142,76%,45%,0.2)" }}>
              <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4" style={{ color: "hsl(142,76%,55%)" }} /><span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Target Year</span></div>
              <p className="text-base font-semibold text-white">{climateData.year}</p>
              <p className="text-xs text-slate-500 mt-0.5">{climateData.year - new Date().getFullYear()} years from now</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: "hsl(222,47%,12%)", border: "1px solid hsla(280,87%,65%,0.2)" }}>
              <div className="flex items-center gap-2 mb-2"><Cloud className="w-4 h-4" style={{ color: "hsl(280,87%,70%)" }} /><span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Model</span></div>
              <p className="text-sm font-semibold text-white">{climateData.metadata?.model}</p>
              <p className="text-xs text-slate-500 mt-0.5">Resolution: {climateData.metadata?.resolution}</p>
            </div>
          </div>

          {/* ── Temperature Analysis ── */}
          <div className="section-card">
            <div className="section-header">
              <Thermometer className="w-5 h-5" style={{ color: "hsl(0,84%,65%)" }} />
              <h3 className="font-semibold text-white">Temperature Analysis</h3>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Annual Mean", value: `${climateData.temperature?.annual_mean?.toFixed(1)}°C`, color: "hsl(0,84%,65%)", note: "[1]" },
                  { label: "Temp Change", value: `+${climateData.temperature?.anomaly?.toFixed(1)}°C`, color: "hsl(24,92%,65%)", note: "[2]" },
                  { label: "Minimum", value: `${climateData.temperature?.min?.toFixed(1)}°C`, color: "hsl(207,90%,65%)", note: "[3]" },
                  { label: "Maximum", value: `${climateData.temperature?.max?.toFixed(1)}°C`, color: "hsl(0,84%,65%)", note: "[3]" },
                ].map(({ label, value, color, note }) => (
                  <div key={label} className="rounded-xl p-3 text-center" style={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,20%)" }}>
                    <p className="text-xs text-slate-500 mb-1">{label}<sup className="text-slate-600">{note}</sup></p>
                    <p className="text-xl font-bold" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-3">Monthly Temperature Distribution</h4>
                <div className="rounded-xl p-4" style={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,20%)" }}>
                  {(() => {
                    const monthlyTemps = climateData.temperature?.monthly || [];
                    const minTemp = Math.min(...monthlyTemps);
                    const maxTemp = Math.max(...monthlyTemps);
                    const range = maxTemp - minTemp;
                    const pad = range * 0.1;
                    const scaleMin = minTemp - pad;
                    const scaleMax = maxTemp + pad;
                    const scaleRange = scaleMax - scaleMin;
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    return (
                      <div className="relative" style={{ height: "220px" }}>
                        <div className="absolute left-0 top-0 bottom-10 w-10 flex flex-col justify-between text-right">
                          {[scaleMax, scaleMax * 0.75 + scaleMin * 0.25, (scaleMax + scaleMin) / 2, scaleMax * 0.25 + scaleMin * 0.75, scaleMin].map((t, i) => (
                            <span key={i} className="text-xs leading-none" style={{ color: "hsl(215,20%,45%)" }}>{t.toFixed(0)}°</span>
                          ))}
                        </div>
                        <div className="absolute left-12 right-0 top-0 bottom-10">
                          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="hsl(0,84%,65%)" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="hsl(0,84%,65%)" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            <polygon
                              fill="url(#tempGrad)"
                              points={[
                                ...monthlyTemps.map((t: number, i: number) => `${(i / 11) * 100},${100 - ((t - scaleMin) / scaleRange) * 100}`),
                                `100,100`, `0,100`
                              ].join(' ')}
                            />
                            <polyline
                              fill="none" stroke="hsl(0,84%,65%)" strokeWidth="2.5"
                              vectorEffect="non-scaling-stroke"
                              points={monthlyTemps.map((t: number, i: number) => `${(i / 11) * 100},${100 - ((t - scaleMin) / scaleRange) * 100}`).join(' ')}
                            />
                            {monthlyTemps.map((t: number, i: number) => (
                              <circle key={i} cx={(i / 11) * 100} cy={100 - ((t - scaleMin) / scaleRange) * 100} r="1.5" fill="hsl(0,84%,65%)" vectorEffect="non-scaling-stroke" />
                            ))}
                          </svg>
                        </div>
                        <div className="absolute left-12 right-0 bottom-0 h-8 flex justify-between items-end">
                          {months.map((m, i) => (
                            <div key={i} className="text-center flex-1">
                              <div className="text-xs leading-none" style={{ color: "hsl(215,20%,45%)" }}>{m}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {climateData.temperature?.monthly?.map((temp: number, i: number) => {
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    return (
                      <div key={i} className="flex justify-between text-xs px-2 py-1 rounded" style={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,18%)" }}>
                        <span className="text-slate-500">{months[i]}</span>
                        <span className="font-mono font-medium" style={{ color: temp >= 0 ? "hsl(0,84%,65%)" : "hsl(207,90%,65%)" }}>{temp?.toFixed(1)}°C</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 text-xs text-slate-500 px-1">
                  Seasonal amplitude: {climateData.temperature?.seasonal_amplitude?.toFixed(1)}°C · Range: {climateData.temperature?.min?.toFixed(1)}°C to {climateData.temperature?.max?.toFixed(1)}°C
                </div>
              </div>
            </div>
          </div>

          {/* ── Precipitation Analysis ── */}
          <div className="section-card">
            <div className="section-header">
              <Droplets className="w-5 h-5" style={{ color: "hsl(207,90%,65%)" }} />
              <h3 className="font-semibold text-white">Precipitation Analysis</h3>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Annual Total", value: `${climateData.precipitation?.annual_total?.toFixed(0)} mm`, sub: (() => { const a = climateData.precipitation?.annual_total || 0; return a > 1200 ? "Very wet" : a > 800 ? "Wet" : a > 500 ? "Moderate" : a > 200 ? "Dry" : "Very dry (arid)"; })(), color: "hsl(207,90%,65%)" },
                  { label: "Change", value: `${climateData.precipitation?.anomaly_percent > 0 ? '+' : ''}${climateData.precipitation?.anomaly_percent?.toFixed(1)}%`, sub: "vs baseline", color: "hsl(142,76%,55%)" },
                  { label: "Wettest Month", value: `${climateData.precipitation?.wettest_month?.toFixed(0)} mm`, sub: climateData.precipitation?.wettest_month_name, color: "hsl(207,90%,65%)" },
                  { label: "Driest Month", value: `${climateData.precipitation?.driest_month?.toFixed(0)} mm`, sub: climateData.precipitation?.driest_month_name, color: "hsl(42,87%,60%)" },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} className="rounded-xl p-3 text-center" style={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,20%)" }}>
                    <p className="text-xs text-slate-500 mb-1">{label}</p>
                    <p className="text-xl font-bold" style={{ color }}>{value}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-3">Monthly Precipitation Distribution</h4>
                <div className="rounded-xl p-4" style={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,20%)" }}>
                  <div className="grid grid-cols-12 gap-1 items-end" style={{ height: "120px" }}>
                    {climateData.precipitation?.monthly?.map((p: number, i: number) => {
                      const maxP = Math.max(...climateData.precipitation.monthly);
                      const pct = Math.max(8, (p / maxP) * 100);
                      const months = ['J','F','M','A','M','J','J','A','S','O','N','D'];
                      return (
                        <div key={i} className="flex flex-col items-center justify-end h-full gap-1">
                          <div className="w-full rounded-t transition-all" style={{ height: `${pct}%`, background: "linear-gradient(to top, hsl(207,90%,50%), hsl(207,90%,75%))", minHeight: "4px" }} title={`${months[i]}: ${p.toFixed(0)}mm`} />
                          <span className="text-xs leading-none" style={{ color: "hsl(215,20%,40%)" }}>{months[i]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {climateData.precipitation?.monthly?.map((p: number, i: number) => {
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    return (
                      <div key={i} className="flex justify-between text-xs px-2 py-1 rounded" style={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,18%)" }}>
                        <span className="text-slate-500">{months[i]}</span>
                        <span className="font-mono font-medium" style={{ color: "hsl(207,90%,65%)" }}>{p.toFixed(0)} mm</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── Extreme Weather ── */}
          <div className="section-card">
            <div className="section-header">
              <AlertTriangle className="w-5 h-5" style={{ color: "hsl(24,92%,65%)" }} />
              <h3 className="font-semibold text-white">Extreme Weather & Risk Assessment</h3>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl p-4 text-center" style={{ background: "hsla(0,84%,60%,0.08)", border: "1px solid hsla(0,84%,60%,0.25)" }}>
                  <p className="text-xs text-slate-500 mb-2">Heat Stress Days<sup className="text-slate-600">[8]</sup></p>
                  <p className="text-3xl font-bold" style={{ color: "hsl(0,84%,65%)" }}>{climateData.extremes?.heat_stress_days || 0}</p>
                  <p className="text-xs text-slate-500 mt-1">days &gt; 35°C</p>
                </div>
                <div className="rounded-xl p-4" style={{ background: "hsla(42,87%,55%,0.08)", border: "1px solid hsla(42,87%,55%,0.25)" }}>
                  <p className="text-xs text-slate-500 mb-2">Drought Risk<sup className="text-slate-600">[9]</sup></p>
                  <div className="flex items-end gap-2 mb-2">
                    <p className="text-3xl font-bold" style={{ color: "hsl(42,87%,65%)" }}>{((climateData.extremes?.drought_risk || 0) * 100).toFixed(0)}%</p>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "hsl(217,33%,20%)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(climateData.extremes?.drought_risk || 0) * 100}%`, background: "hsl(42,87%,55%)" }} />
                  </div>
                </div>
                <div className="rounded-xl p-4" style={{ background: "hsla(207,90%,54%,0.08)", border: "1px solid hsla(207,90%,54%,0.25)" }}>
                  <p className="text-xs text-slate-500 mb-2">Flood Risk<sup className="text-slate-600">[10]</sup></p>
                  <p className="text-3xl font-bold mb-2" style={{ color: "hsl(207,90%,65%)" }}>{((climateData.extremes?.flood_risk || 0) * 100).toFixed(0)}%</p>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "hsl(217,33%,20%)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(climateData.extremes?.flood_risk || 0) * 100}%`, background: "hsl(207,90%,54%)" }} />
                  </div>
                </div>
                <div className="rounded-xl p-4 text-center" style={{ background: "hsla(192,91%,46%,0.08)", border: "1px solid hsla(192,91%,46%,0.25)" }}>
                  <p className="text-xs text-slate-500 mb-2">Sea Level Rise<sup className="text-slate-600">[11]</sup></p>
                  <p className="text-3xl font-bold" style={{ color: "hsl(192,91%,60%)" }}>{climateData.extremes?.sea_level_rise_cm?.toFixed(1)}<span className="text-lg"> cm</span></p>
                  <p className="text-xs text-slate-500 mt-1">by {climateData.year}</p>
                </div>
              </div>
              <div className="rounded-xl p-4 text-sm" style={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,20%)" }}>
                <ul className="space-y-1.5 text-slate-400">
                  <li><span className="text-white font-medium">Heat Stress Days:</span> Days exceeding 35°C WHO threshold — dangerous for human health and agriculture</li>
                  <li><span className="text-white font-medium">Drought Risk:</span> Probability of water scarcity based on precipitation deficits and evapotranspiration</li>
                  <li><span className="text-white font-medium">Flood Risk:</span> Likelihood of flooding from extreme precipitation events and soil saturation</li>
                  <li><span className="text-white font-medium">Sea Level Rise:</span> Projected coastal sea level increase by the target year</li>
                </ul>
              </div>
            </div>
          </div>

          {/* ── Habitability ── */}
          <div className="section-card">
            <div className="section-header">
              <Award className="w-5 h-5" style={{ color: "hsl(142,76%,55%)" }} />
              <h3 className="font-semibold text-white">Habitability Assessment</h3>
            </div>
            <div className="p-5 space-y-5">
              <div className="rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6" style={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,20%)" }}>
                <ScoreRing score={habitScore} />
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center gap-3 justify-center sm:justify-start mb-2">
                    <span className="text-2xl font-bold text-white">Overall Habitability</span>
                    <HabitabilityBadge score={habitScore} />
                  </div>
                  <p className="text-sm text-slate-400 mb-4">Based on temperature comfort, precipitation adequacy, and extreme weather risks</p>
                  <GlobalRankingDisplay
                    currentScore={climateData.habitability?.score || 0}
                    targetYear={climateData.year}
                    latitude={climateData.location?.latitude || 0}
                    longitude={climateData.location?.longitude || 0}
                  />
                </div>
              </div>

              {/* Score scale */}
              <div className="grid grid-cols-5 gap-2">
                {[
                  { range: "80-100", label: "Excellent", color: "hsla(142,76%,45%,0.15)", border: "hsla(142,76%,45%,0.35)", text: "hsl(142,76%,55%)" },
                  { range: "60-79", label: "Good", color: "hsla(207,90%,54%,0.15)", border: "hsla(207,90%,54%,0.35)", text: "hsl(207,90%,65%)" },
                  { range: "40-59", label: "Fair", color: "hsla(42,87%,55%,0.15)", border: "hsla(42,87%,55%,0.35)", text: "hsl(42,87%,65%)" },
                  { range: "20-39", label: "Poor", color: "hsla(24,92%,60%,0.15)", border: "hsla(24,92%,60%,0.35)", text: "hsl(24,92%,65%)" },
                  { range: "0-19", label: "Severe", color: "hsla(0,84%,60%,0.15)", border: "hsla(0,84%,60%,0.35)", text: "hsl(0,84%,65%)" },
                ].map(({ range, label, color, border, text }) => (
                  <div key={range} className="rounded-lg p-2 text-center border" style={{ background: color, borderColor: border }}>
                    <div className="text-xs font-bold" style={{ color: text }}>{range}</div>
                    <div className="text-xs" style={{ color: text }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Score breakdown waterfall */}
              {climateData.habitability?.breakdown && (
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-3">Score Breakdown</h4>
                  <div className="rounded-xl p-4" style={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,20%)" }}>
                    {(() => {
                      const b = climateData.habitability.breakdown;
                      const items = [
                        { name: "Temp Comfort", value: b.temperature_comfort, color: "hsl(0,84%,60%)", positive: true },
                        { name: "Precipitation", value: b.precipitation_adequacy, color: "hsl(207,90%,55%)", positive: true },
                        { name: "Infrastructure", value: b.infrastructure_adaptation, color: "hsl(142,76%,45%)", positive: true },
                        { name: "Heat Penalty", value: -b.heat_stress_penalty, color: "hsl(24,92%,55%)", positive: false },
                        { name: "Drought Risk", value: -b.drought_risk_penalty, color: "hsl(42,87%,55%)", positive: false },
                        { name: "Flood Risk", value: -b.flood_risk_penalty, color: "hsl(192,91%,46%)", positive: false },
                      ];
                      return (
                        <div className="space-y-2">
                          {items.map(({ name, value, color, positive }) => (
                            <div key={name} className="flex items-center gap-3">
                              <div className="text-xs text-slate-500 w-24 shrink-0">{name}</div>
                              <div className="flex-1 flex items-center gap-2">
                                <div className="flex-1 h-5 rounded overflow-hidden relative" style={{ background: "hsl(217,33%,18%)" }}>
                                  <div className="h-full rounded transition-all duration-500" style={{ width: `${Math.min(100, Math.abs(value) / 35 * 100)}%`, background: color, opacity: positive ? 1 : 0.7 }} />
                                </div>
                                <span className="text-xs font-mono w-12 text-right" style={{ color: positive ? "hsl(142,76%,55%)" : "hsl(0,84%,65%)" }}>
                                  {positive ? "+" : ""}{value.toFixed(1)}
                                </span>
                              </div>
                            </div>
                          ))}
                          <div className="pt-2 mt-2 flex items-center gap-3" style={{ borderTop: "1px solid hsl(217,33%,22%)" }}>
                            <div className="text-xs font-semibold text-white w-24 shrink-0">Final Score</div>
                            <div className="flex-1 flex items-center gap-2">
                              <div className="flex-1 h-5 rounded overflow-hidden" style={{ background: "hsl(217,33%,18%)" }}>
                                <div className="h-full rounded" style={{ width: `${habitScore}%`, background: "linear-gradient(90deg, hsl(142,76%,40%), hsl(192,91%,46%))" }} />
                              </div>
                              <span className="text-xs font-mono font-bold w-12 text-right text-white">{habitScore.toFixed(1)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Livability breakdown */}
              <LivabilityIndexBreakdown
                score={climateData.habitability?.score || 0}
                breakdown={climateData.habitability?.breakdown}
                location={climateData.location?.name}
                year={climateData.year}
              />
            </div>
          </div>

          {/* ── Climate Time Series ── */}
          {climateData.time_series && (
            <div className="section-card">
              <div className="section-header">
                <TrendingUp className="w-5 h-5" style={{ color: "hsl(192,91%,56%)" }} />
                <h3 className="font-semibold text-white">Climate Trends Over Time</h3>
              </div>
              <div className="p-5 space-y-6">
                {/* Temperature table */}
                <div>
                  <h4 className="text-sm font-medium mb-2" style={{ color: "hsl(0,84%,65%)" }}>Monthly Temperature Projections (°C)<sup className="text-slate-600">[3]</sup></h4>
                  <p className="text-xs text-slate-500 mb-2">Baseline: {climateData.time_series.temperature_baseline?.toFixed(1)}°C</p>
                  <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid hsl(217,33%,20%)" }}>
                    <table className="climate-table w-full text-xs">
                      <thead>
                        <tr>
                          <th className="px-2 py-2 text-left sticky left-0" style={{ background: "hsl(222,47%,10%)", color: "hsl(215,20%,55%)" }}>Year</th>
                          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => (
                            <th key={m} className="px-1.5 py-2 text-center min-w-[42px]" style={{ background: "hsl(222,47%,10%)", color: "hsl(215,20%,55%)" }}>{m}</th>
                          ))}
                          <th className="px-2 py-2 text-center min-w-[52px]" style={{ background: "hsl(222,47%,10%)", color: "hsl(215,20%,55%)" }}>Annual</th>
                          <th className="px-2 py-2 text-center min-w-[52px]" style={{ background: "hsl(222,47%,10%)", color: "hsl(215,20%,55%)" }}>Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {climateData.time_series.years?.map((yr: number, idx: number) => {
                          const mTemps = climateData.time_series.monthly_temperature_series?.[idx] || [];
                          const annual = climateData.time_series.temperature_trend?.[idx];
                          const diff = climateData.time_series.temperature_differences?.[idx];
                          const isTarget = yr === climateData.year;
                          return (
                            <tr key={yr} style={{ background: isTarget ? "hsla(192,91%,46%,0.07)" : "transparent" }}>
                              <td className="px-2 py-1.5 font-semibold text-white sticky left-0" style={{ background: isTarget ? "hsla(192,91%,46%,0.12)" : "hsl(222,47%,11%)" }}>{yr}{isTarget && <span className="ml-1 text-cyan-500">★</span>}</td>
                              {mTemps.map((t: number, mi: number) => (
                                <td key={mi} className="px-1.5 py-1.5 text-center font-mono" style={{ color: t >= 0 ? "hsl(0,84%,65%)" : "hsl(207,90%,65%)" }}>{t?.toFixed(1)}</td>
                              ))}
                              <td className="px-2 py-1.5 text-center font-mono font-semibold text-white">{annual?.toFixed(1)}</td>
                              <td className="px-2 py-1.5 text-center font-mono font-semibold" style={{ color: diff >= 0 ? "hsl(0,84%,65%)" : "hsl(207,90%,65%)" }}>{diff >= 0 ? "+" : ""}{diff?.toFixed(1)}°</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Precipitation table */}
                <div>
                  <h4 className="text-sm font-medium mb-2" style={{ color: "hsl(207,90%,65%)" }}>Monthly Precipitation Projections (mm)<sup className="text-slate-600">[6]</sup></h4>
                  <p className="text-xs text-slate-500 mb-2">Baseline: {climateData.time_series.precipitation_baseline?.toFixed(0)} mm</p>
                  <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid hsl(217,33%,20%)" }}>
                    <table className="climate-table w-full text-xs">
                      <thead>
                        <tr>
                          <th className="px-2 py-2 text-left sticky left-0" style={{ background: "hsl(222,47%,10%)", color: "hsl(215,20%,55%)" }}>Year</th>
                          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => (
                            <th key={m} className="px-1.5 py-2 text-center min-w-[42px]" style={{ background: "hsl(222,47%,10%)", color: "hsl(215,20%,55%)" }}>{m}</th>
                          ))}
                          <th className="px-2 py-2 text-center" style={{ background: "hsl(222,47%,10%)", color: "hsl(215,20%,55%)" }}>Annual</th>
                          <th className="px-2 py-2 text-center" style={{ background: "hsl(222,47%,10%)", color: "hsl(215,20%,55%)" }}>Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {climateData.time_series.years?.map((yr: number, idx: number) => {
                          const mP = climateData.time_series.monthly_precipitation_series?.[idx] || [];
                          const annual = climateData.time_series.precipitation_trend?.[idx];
                          const diff = climateData.time_series.precipitation_differences?.[idx];
                          const isTarget = yr === climateData.year;
                          return (
                            <tr key={yr} style={{ background: isTarget ? "hsla(207,90%,54%,0.07)" : "transparent" }}>
                              <td className="px-2 py-1.5 font-semibold text-white sticky left-0" style={{ background: isTarget ? "hsla(207,90%,54%,0.12)" : "hsl(222,47%,11%)" }}>{yr}{isTarget && <span className="ml-1 text-blue-400">★</span>}</td>
                              {mP.map((p: number, mi: number) => (
                                <td key={mi} className="px-1.5 py-1.5 text-center font-mono" style={{ color: "hsl(207,90%,65%)" }}>{p?.toFixed(0)}</td>
                              ))}
                              <td className="px-2 py-1.5 text-center font-mono font-semibold text-white">{annual?.toFixed(0)}</td>
                              <td className="px-2 py-1.5 text-center font-mono font-semibold" style={{ color: diff >= 0 ? "hsl(142,76%,55%)" : "hsl(24,92%,65%)" }}>{diff >= 0 ? "+" : ""}{diff?.toFixed(0)} mm</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Habitability trend */}
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-3">Habitability Trend</h4>
                  <div className="space-y-2">
                    {climateData.time_series.years?.map((yr: number, idx: number) => {
                      const h = climateData.time_series.habitability_trend[idx];
                      const prev = idx > 0 ? climateData.time_series.habitability_trend[idx - 1] : null;
                      const change = prev ? h - prev : 0;
                      const isTarget = yr === climateData.year;
                      const barColor = h >= 80 ? "hsl(142,76%,45%)" : h >= 60 ? "hsl(207,90%,54%)" : h >= 40 ? "hsl(42,87%,55%)" : h >= 20 ? "hsl(24,92%,55%)" : "hsl(0,84%,55%)";
                      return (
                        <div key={yr} className="rounded-xl p-3 flex items-center gap-3" style={{ background: isTarget ? "hsla(192,91%,46%,0.07)" : "hsl(222,47%,10%)", border: `1px solid ${isTarget ? "hsla(192,91%,46%,0.25)" : "hsl(217,33%,20%)"}` }}>
                          <span className="text-sm font-medium text-white w-12 shrink-0">{yr}</span>
                          <div className="flex-1 h-6 rounded-lg overflow-hidden relative" style={{ background: "hsl(217,33%,18%)" }}>
                            <div className="h-full rounded-lg transition-all" style={{ width: `${h}%`, background: barColor }} />
                            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color: h > 50 ? "white" : "hsl(215,20%,65%)" }}>{h?.toFixed(1)}/100</span>
                          </div>
                          <span className="text-xs text-slate-500 w-16 shrink-0 text-right">{h >= 80 ? "Excellent" : h >= 60 ? "Good" : h >= 40 ? "Fair" : h >= 20 ? "Poor" : "Severe"}</span>
                          <span className="text-xs font-medium w-12 text-right shrink-0" style={{ color: change > 0 ? "hsl(142,76%,55%)" : change < 0 ? "hsl(0,84%,65%)" : "hsl(215,20%,50%)" }}>
                            {change === 0 ? "±0.0" : change > 0 ? `+${change.toFixed(1)}` : change.toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 text-xs text-slate-500 px-1">
                    ★ marks the target year. Δ shows change from prior 5-year interval.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Atmospheric Physics ── */}
          {climateData.atmospheric_physics && (
            <div className="section-card">
              <div className="section-header">
                <Wind className="w-5 h-5" style={{ color: "hsl(280,87%,70%)" }} />
                <h3 className="font-semibold text-white">Atmospheric Physics & Climate Dynamics</h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="rounded-xl p-4" style={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,20%)" }}>
                    <h4 className="text-sm font-medium mb-2" style={{ color: "hsl(280,87%,70%)" }}>Circulation Pattern</h4>
                    <p className="text-sm text-slate-400">{climateData.atmospheric_physics.circulation_pattern}</p>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,20%)" }}>
                    <h4 className="text-sm font-medium mb-2" style={{ color: "hsl(192,91%,60%)" }}>Climate Sensitivity</h4>
                    <p className="text-sm text-slate-400">Regional factor: <span className="text-white font-semibold">{climateData.atmospheric_physics.climate_sensitivity}×</span> global average</p>
                    <p className="text-xs text-slate-600 mt-1">Higher values indicate greater temperature response to radiative forcing</p>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-3">Feedback Mechanisms</h4>
                  <div className="space-y-2">
                    {climateData.atmospheric_physics.feedback_mechanisms?.map((fb: string, i: number) => (
                      <div key={i} className="rounded-lg px-4 py-2.5 text-sm text-slate-400 border-l-2" style={{ background: "hsl(222,47%,10%)", borderColor: "hsl(280,87%,55%)" }}>
                        {fb}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Global Rankings ── */}
          <HabitabilityRanking
            selectedYear={climateData.year}
            onLocationSelect={(lat, lng) => {
              setSelectedLocation({ name: `Location ${lat.toFixed(2)}, ${lng.toFixed(2)}`, lat, lng, country: '', city: '', state: '' });
              setLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            }}
          />

          {/* ── Methodology ── */}
          <div className="section-card">
            <div className="section-header">
              <BarChart2 className="w-5 h-5" style={{ color: "hsl(215,20%,55%)" }} />
              <h3 className="font-semibold text-white">Data Quality & Methodology</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="rounded-xl p-4" style={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,20%)" }}>
                  <h4 className="font-medium text-slate-300 mb-3">Model Information</h4>
                  <div className="space-y-1.5">
                    {[["Model", climateData.metadata?.model], ["Version", climateData.metadata?.model_version], ["Resolution", climateData.metadata?.resolution], ["Confidence", climateData.metadata?.confidence]].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <span className="text-slate-500">{k}</span>
                        <span className="text-slate-300 font-medium">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl p-4" style={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,20%)" }}>
                  <h4 className="font-medium text-slate-300 mb-3">Temporal Coverage</h4>
                  <div className="space-y-1.5">
                    {[["Base Year", new Date().getFullYear()], ["Target Year", climateData.year], ["Projection Period", `${climateData.year - new Date().getFullYear()} years`], ["Time Series", "5-year intervals"]].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <span className="text-slate-500">{k}</span>
                        <span className="text-slate-300 font-medium">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl p-4" style={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,20%)" }}>
                  <h4 className="font-medium text-slate-300 mb-3">Generation</h4>
                  <div className="space-y-1.5">
                    {[["Method", climateData.metadata?.projection_method], ["Source", climateData.metadata?.data_source]].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2 text-xs">
                        <span className="text-slate-500 shrink-0">{k}</span>
                        <span className="text-slate-300 font-medium text-right">{v}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Generated</span>
                      <span className="text-slate-300 font-medium">{new Date(climateData.metadata?.generated_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl p-4 text-xs text-slate-500" style={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,20%)" }}>
                <p className="font-medium text-slate-300 mb-2">Methodology Note</p>
                <p>This implementation uses atmospheric physics patterns from NVIDIA's CBottle project, employing the ICON atmospheric model framework. Climate projections incorporate realistic seasonal patterns, atmospheric circulation dynamics, regional climate sensitivity factors, and physical feedback mechanisms.</p>
              </div>

              {/* Scientific references — collapsible */}
              <details className="rounded-xl overflow-hidden" style={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,20%)" }}>
                <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-slate-300 hover:text-white transition-colors select-none">
                  Scientific References & Data Sources [1–26]
                </summary>
                <div className="px-4 pb-4 text-xs text-slate-500 space-y-2 max-h-80 overflow-y-auto">
                  {[
                    ["[1] Annual Mean Temperature", "CBottle atmospheric physics calculation using ICON model baseline meteorological data."],
                    ["[2] Temperature Change (Anomaly)", "CBottle climate sensitivity analysis incorporating greenhouse gas forcing and regional feedback mechanisms."],
                    ["[3] Monthly Temperature Extremes", "CBottle seasonal temperature distribution modeling based on atmospheric physics constraints."],
                    ["[4] Annual Precipitation Total", "CBottle precipitation model using ICON atmospheric moisture transport calculations."],
                    ["[5] Precipitation Change", "CBottle hydrological cycle modeling incorporating temperature-driven evaporation changes."],
                    ["[6] Monthly Precipitation", "CBottle seasonal precipitation distribution with realistic wet/dry season patterns."],
                    ["[7] Habitability Score", "Multi-factor assessment: temperature comfort (30%), precipitation adequacy (30%), infrastructure adaptation (40%), minus risk penalties."],
                    ["[8] Heat Stress Days", "Annual days exceeding 35°C threshold using extreme value analysis."],
                    ["[9] Drought Risk", "Palmer Drought Severity Index methodology with precipitation deficit analysis."],
                    ["[10] Flood Risk", "Extreme precipitation analysis and hydrological runoff calculations."],
                    ["[11] Sea Level Rise", "Global mean sea level rise projections with regional adjustment factors."],
                    ["[12] Seasonal Amplitude", "max(monthly temperature) − min(monthly temperature)."],
                    ["[13] Temperature Comfort Score", "Optimal range 15-25°C, steep penalties for heat above 25°C, graduated penalties for cold."],
                    ["[14] Precipitation Adequacy Score", "Optimal annual range 600-1200mm for human settlement."],
                    ["[15] Infrastructure Adaptation Score", "Latitude-based development potential, coastal proximity, regional economic capacity."],
                    ["[16-18] Risk Penalties", "Heat stress, drought, and flood penalties applied proportionally to projection values."],
                    ["[19-26] Global Rankings", "CBottle habitability scores sorted globally by category (best overall, worst, biggest decline, temperature, humidity, infrastructure)."],
                  ].map(([ref, desc]) => (
                    <div key={ref}>
                      <span className="font-medium text-slate-400">{ref}:</span> {desc}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>

        </main>
      )}

      <footer className="mt-8 py-6 text-center text-xs text-slate-600" style={{ borderTop: "1px solid hsl(217,33%,15%)" }}>
        ClimateVision · Powered by CBottle/ICON Atmospheric Physics · For research and planning purposes only
      </footer>
    </div>
  );
}
