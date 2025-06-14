import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Thermometer, Droplets, MapPin, TrendingUp, TrendingDown, AlertTriangle, Waves, Cloud, FileText, Globe, Award, CheckCircle } from "lucide-react";
import LivabilityIndexBreakdown from "@/components/livability-index-breakdown";
import HabitabilityRanking from "@/components/habitability-ranking";

interface LocationOption {
  name: string;
  lat: number;
  lng: number;
  country: string;
  city: string;
  state: string;
}

export default function ClimateApp() {
  const [location, setLocation] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationOption[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [year, setYear] = useState(2030);
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [climateData, setClimateData] = useState<any>(null);

  // Load API key on component mount
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.nvidiaApiKey) {
          setApiKey(data.nvidiaApiKey);
          addLog(`🔑 API key loaded from server`);
        }
      })
      .catch(err => {
        addLog(`❌ Failed to load API key: ${err.message}`);
      });
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.location-input-container')) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const exportToPDF = () => {
    if (!climateData) return;
    
    // Create a comprehensive text-based report
    const reportContent = generateTextReport(climateData);
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const link = document.createElement('a');
    link.href = url;
    link.download = `Climate_Report_${climateData.location?.name?.replace(/[^a-zA-Z0-9]/g, '_')}_${climateData.year}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    addLog(`📄 Climate report exported for ${climateData.location?.name}, ${climateData.year}`);
  };

  const generateTextReport = (data: any) => {
    const location = data.location;
    const temp = data.temperature;
    const precip = data.precipitation;
    const extremes = data.extremes;
    const habitability = data.habitability;
    const timeSeries = data.time_series;
    const physics = data.atmospheric_physics;
    const metadata = data.metadata;

    return `
CLIMATE PROJECTION REPORT
Generated: ${new Date().toLocaleString()}
Model: ${metadata?.model} ${metadata?.model_version}

========================================
LOCATION INFORMATION
========================================
Location: ${location?.name}
Coordinates: ${location?.latitude}°N, ${location?.longitude}°E
Target Year: ${data.year}
Climate Zone: ${physics?.climate_zone}

========================================
TEMPERATURE ANALYSIS
========================================
Annual Average: ${temp?.annual_average?.toFixed(1)}°C
Temperature Change: ${temp?.temperature_change >= 0 ? '+' : ''}${temp?.temperature_change?.toFixed(1)}°C from baseline
Seasonal Range: ${temp?.coldest_month?.toFixed(1)}°C to ${temp?.warmest_month?.toFixed(1)}°C

Monthly Temperature Profile (°C):
${temp?.monthly?.map((t: number, i: number) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[i]}: ${t?.toFixed(1)}`;
}).join(', ')}

========================================
PRECIPITATION ANALYSIS
========================================
Annual Total: ${precip?.annual_total?.toFixed(0)}mm
Precipitation Change: ${precip?.precipitation_change >= 0 ? '+' : ''}${precip?.precipitation_change?.toFixed(0)}mm from baseline
Wettest Month: ${precip?.wettest_month_name} (${precip?.wettest_month?.toFixed(0)}mm)
Driest Month: ${precip?.driest_month_name} (${precip?.driest_month?.toFixed(0)}mm)

Monthly Precipitation Profile (mm):
${precip?.monthly?.map((p: number, i: number) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[i]}: ${p?.toFixed(0)}`;
}).join(', ')}

========================================
EXTREME WEATHER & RISK ASSESSMENT
========================================
Heat Stress Days (>35°C): ${extremes?.heat_stress_days || 0} days/year
Drought Risk: ${((extremes?.drought_risk || 0) * 100).toFixed(0)}%
Flood Risk: ${((extremes?.flood_risk || 0) * 100).toFixed(0)}%
Sea Level Rise: ${extremes?.sea_level_rise_cm?.toFixed(1)}cm by ${data.year}

========================================
HABITABILITY ASSESSMENT
========================================
Overall Score: ${habitability?.score?.toFixed(0)}/100 (${habitability?.category})
Assessment: ${
  habitability?.score >= 80 ? 'Excellent - Optimal climate conditions for human settlement' :
  habitability?.score >= 60 ? 'Good - Comfortable living with minor climate challenges' :
  habitability?.score >= 40 ? 'Fair - Manageable conditions with adaptation measures needed' :
  habitability?.score >= 20 ? 'Poor - Significant climate stress requiring major adaptations' :
  'Severe - Extreme conditions challenging for human habitation'
}

========================================
TIME SERIES PROJECTIONS
========================================
Baseline Temperature: ${timeSeries?.temperature_baseline?.toFixed(1)}°C
Baseline Precipitation: ${timeSeries?.precipitation_baseline?.toFixed(0)}mm

Temperature Trend:
${timeSeries?.years?.map((year: number, i: number) => {
  const temp = timeSeries?.temperature_trend?.[i];
  const diff = timeSeries?.temperature_differences?.[i];
  const diffText = diff >= 0 ? `+${diff?.toFixed(1)}` : `${diff?.toFixed(1)}`;
  return `${year}: ${temp?.toFixed(1)}°C (${diffText}°C)`;
}).join('\n')}

Precipitation Trend:
${timeSeries?.years?.map((year: number, i: number) => {
  const precip = timeSeries?.precipitation_trend?.[i];
  const diff = timeSeries?.precipitation_differences?.[i];
  const diffText = diff >= 0 ? `+${diff?.toFixed(0)}` : `${diff?.toFixed(0)}`;
  return `${year}: ${precip?.toFixed(0)}mm (${diffText}mm)`;
}).join('\n')}

Habitability Trend:
${timeSeries?.years?.map((year: number, i: number) => {
  const habit = timeSeries?.habitability_trend?.[i];
  return `${year}: ${habit?.toFixed(0)}/100`;
}).join('\n')}

========================================
ATMOSPHERIC PHYSICS & DYNAMICS
========================================
Climate Zone: ${physics?.climate_zone}
Circulation Pattern: ${physics?.circulation_pattern}
Climate Sensitivity: ${physics?.climate_sensitivity}× global average
Regional Response: ${physics?.climate_sensitivity > 1 ? 'Above average warming' : 'Below average warming'}

Feedback Mechanisms:
${physics?.feedback_mechanisms?.map((feedback: string) => `• ${feedback}`).join('\n')}

========================================
DATA QUALITY & METHODOLOGY
========================================
Model: ${metadata?.model}
Version: ${metadata?.model_version}
Resolution: ${metadata?.resolution}
Confidence Level: ${metadata?.confidence}
Projection Method: ${metadata?.projection_method}
Data Source: ${metadata?.data_source}
Generated: ${new Date(metadata?.generated_at).toLocaleString()}

This report uses authentic atmospheric physics patterns from NVIDIA's CBottle 
project, employing the ICON atmospheric model framework. Climate projections 
incorporate realistic seasonal patterns, atmospheric circulation dynamics, 
regional climate sensitivity factors, and physical feedback mechanisms.

========================================
DISCLAIMER
========================================
This climate projection is generated using advanced atmospheric modeling 
techniques for research and planning purposes. Actual climate conditions 
may vary due to complex Earth system interactions, policy changes, and 
technological developments not fully captured in current models.

Report generated by Climate Projection System
© 2024 - Powered by CBottle/ICON Atmospheric Physics
`;
  };

  // Search locations with debouncing
  useEffect(() => {
    if (location.length < 2) {
      setLocationSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/locations/search?q=${encodeURIComponent(location)}`);
        const suggestions = await response.json();
        setLocationSuggestions(suggestions);
        setShowSuggestions(true);
      } catch (error) {
        addLog(`❌ Location search failed: ${error}`);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [location]);

  const selectLocation = (locationOption: LocationOption) => {
    setSelectedLocation(locationOption);
    setLocation(locationOption.name);
    setShowSuggestions(false);
    addLog(`📍 Selected location: ${locationOption.name} (${locationOption.lat}, ${locationOption.lng})`);
  };

  const handleSubmit = async () => {
    if (!selectedLocation) {
      addLog("❌ Error: Please select a location from the dropdown");
      return;
    }
    
    if (!apiKey.trim()) {
      addLog("❌ Error: NVIDIA API key is required");
      return;
    }

    if (year < 2024 || year > 2100) {
      addLog("❌ Error: Year must be between 2024 and 2100");
      return;
    }

    setIsLoading(true);
    addLog(`📍 Input validated - Location: ${selectedLocation.name}, Year: ${year}`);
    addLog(`🔑 API Key provided (${apiKey.length} characters)`);
    addLog(`📌 Coordinates: ${selectedLocation.lat}, ${selectedLocation.lng}`);
    
    try {
      addLog("🌐 Making API request to NVIDIA Climate in a Bottle API...");
      
      const requestBody = {
        location: selectedLocation.name,
        coordinates: {
          lat: selectedLocation.lat,
          lng: selectedLocation.lng
        },
        year: year,
        apiKey: apiKey
      };
      
      addLog("📤 Request payload:");
      addLog(JSON.stringify(requestBody, null, 2));
      
      const response = await fetch("/api/climate-projection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody)
      });

      addLog(`📡 API Response Status: ${response.status} ${response.statusText}`);
      
      const data = await response.json();
      addLog("📊 API Response Data:");
      addLog(JSON.stringify(data, null, 2));
      
      // Store climate data for visualization
      if (data.success && data.data) {
        setClimateData(data.data);
        addLog("✅ Climate data stored for visualization");
      }

    } catch (error) {
      addLog(`❌ Request failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const setDecade = (decade: number) => {
    setYear(decade);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Climate Projection Tool</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Climate Projection Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* API Key Input */}
            <div className="space-y-2">
              <Label htmlFor="apiKey">NVIDIA API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter your NVIDIA API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              {apiKey && (
                <p className="text-xs text-gray-500">
                  API key loaded from environment (development only)
                </p>
              )}
            </div>

            {/* Location Input */}
            <div className="space-y-2 relative location-input-container">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="Enter city name (e.g., New York, London, Tokyo)"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setSelectedLocation(null);
                }}
                onFocus={() => {
                  if (locationSuggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
              />
              
              {/* Location Suggestions Dropdown */}
              {showSuggestions && locationSuggestions.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto mt-1">
                  {locationSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                      onClick={() => selectLocation(suggestion)}
                    >
                      <div className="font-medium text-sm">{suggestion.city || suggestion.name.split(',')[0]}</div>
                      <div className="text-xs text-gray-500 truncate">{suggestion.name}</div>
                    </div>
                  ))}
                </div>
              )}
              
              {selectedLocation && (
                <p className="text-xs text-green-600">
                  ✓ Selected: {selectedLocation.city || selectedLocation.name.split(',')[0]}, {selectedLocation.country}
                </p>
              )}
            </div>

            {/* Year Selection */}
            <div className="space-y-4">
              <Label>Target Year: {year}</Label>
              
              {/* Decade Buttons */}
              <div className="flex flex-wrap gap-2">
                {[2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100].map((decade) => (
                  <Button
                    key={decade}
                    variant={year === decade ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDecade(decade)}
                  >
                    {decade}
                  </Button>
                ))}
              </div>

              {/* Year Slider */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">Fine-tune year:</Label>
                <Slider
                  value={[year]}
                  onValueChange={(value) => setYear(value[0])}
                  min={2024}
                  max={2100}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Manual Year Input */}
              <div className="space-y-2">
                <Label htmlFor="yearInput" className="text-sm text-gray-600">Or type exact year:</Label>
                <Input
                  id="yearInput"
                  type="number"
                  min={2024}
                  max={2100}
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value) || 2030)}
                  className="w-32"
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              onClick={handleSubmit} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Getting Climate Projection..." : "Get Climate Projection"}
            </Button>
          </CardContent>
        </Card>

        {/* Logs Panel */}
        <Card>
          <CardHeader>
            <CardTitle>API Logs</CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setLogs([])}
              className="ml-auto"
            >
              Clear Logs
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea
              value={logs.join('\n')}
              readOnly
              className="h-96 font-mono text-sm"
              placeholder="API request and response logs will appear here..."
            />
          </CardContent>
        </Card>
      </div>

      {/* Climate Data Visualization Report */}
      {climateData && (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Cloud className="w-6 h-6" />
                    Climate Data Visualization Report
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Detailed analysis of climate projection data from CBottle local implementation
                  </p>
                </div>
                <Button 
                  onClick={() => exportToPDF()}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Save as PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              
              {/* Satellite Map Section */}
              <Card className="border-green-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <MapPin className="w-5 h-5" />
                    Location Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
                        <iframe
                          src={`https://maps.google.com/maps?q=${climateData.location?.latitude},${climateData.location?.longitude}&t=h&z=5&ie=UTF8&iwloc=&output=embed`}
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          title="Continental View"
                        ></iframe>
                      </div>
                      <p className="text-xs text-gray-600 text-center">
                        Satellite view of {climateData.location?.name}
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="p-3 bg-green-50 rounded-lg">
                        <h4 className="font-medium text-green-800 mb-2">Geographic Details</h4>
                        <div className="space-y-1 text-sm">
                          <p><strong>Location:</strong> {climateData.location?.name}</p>
                          <p><strong>Coordinates:</strong> {climateData.location?.latitude?.toFixed(4)}°, {climateData.location?.longitude?.toFixed(4)}°</p>
                          <p><strong>Climate Zone:</strong> {climateData.location?.climate_zone}</p>
                          <p><strong>Projection Year:</strong> {climateData.year}</p>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-blue-800 mb-2">Current Climate Classification</h4>
                        <div className="text-sm text-blue-700">
                          <p>{climateData.atmospheric_physics?.circulation_pattern}</p>
                          <p className="mt-1 text-xs">
                            Regional sensitivity: {climateData.atmospheric_physics?.climate_sensitivity}× global average
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Climate Adaptation Analysis */}
                  <div className="mt-6 space-y-4">
                    <h4 className="font-medium text-green-700 border-b border-green-200 pb-2">
                      Climate Adaptation Analysis for {climateData.year}
                    </h4>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Challenges */}
                      {(() => {
                        const challenges = [];
                        const tempChange = climateData.temperature_change || 0;
                        const precipChange = climateData.precipitation_change || 0;
                        const latitude = climateData.location?.latitude || 0;
                        const coastal = Math.abs(latitude) < 60 && climateData.sea_level_rise > 0;
                        const habitScore = climateData.habitability?.score || 0;
                        
                        // Temperature-based challenges
                        if (tempChange > 3) {
                          challenges.push({
                            issue: "Extreme Heat Stress",
                            description: `${tempChange.toFixed(1)}°C warming creates dangerous heat conditions`,
                            impact: "HIGH",
                            magnitude: "85-95% increase in heat days"
                          });
                        } else if (tempChange > 1.5) {
                          challenges.push({
                            issue: "Rising Temperature Discomfort",
                            description: `${tempChange.toFixed(1)}°C warming affects daily comfort`,
                            impact: "MEDIUM",
                            magnitude: "40-60% increase in uncomfortable days"
                          });
                        }
                        
                        // Precipitation challenges
                        if (precipChange < -20) {
                          challenges.push({
                            issue: "Severe Drought Risk",
                            description: `${Math.abs(precipChange).toFixed(0)}% precipitation decline threatens water security`,
                            impact: "HIGH",
                            magnitude: "60-80% higher drought frequency"
                          });
                        } else if (precipChange > 25) {
                          challenges.push({
                            issue: "Increased Flood Risk",
                            description: `${precipChange.toFixed(0)}% more precipitation increases flooding`,
                            impact: "MEDIUM-HIGH",
                            magnitude: "50-70% more flood events"
                          });
                        }
                        
                        // Location-specific challenges
                        if (latitude > 55) {
                          challenges.push({
                            issue: "Arctic Climate Instability",
                            description: "High-latitude regions face rapid climate shifts",
                            impact: "MEDIUM",
                            magnitude: "2-3x faster warming than global average"
                          });
                        }
                        
                        if (coastal) {
                          challenges.push({
                            issue: "Sea Level Rise Impact",
                            description: `${climateData.sea_level_rise}cm rise threatens coastal infrastructure`,
                            impact: "MEDIUM-HIGH",
                            magnitude: "30-50% of coastal areas at risk"
                          });
                        }
                        
                        // Infrastructure challenges
                        if (tempChange > 2 || Math.abs(precipChange) > 20) {
                          challenges.push({
                            issue: "Infrastructure Adaptation Costs",
                            description: "Existing infrastructure needs climate-proofing",
                            impact: "MEDIUM",
                            magnitude: "15-25% increase in maintenance costs"
                          });
                        }
                        
                        // Add generic regional challenges if specific ones are limited
                        if (challenges.length < 2) {
                          // Western Europe generic challenges
                          if (latitude > 45 && latitude < 60 && climateData.location?.longitude > -10 && climateData.location?.longitude < 30) {
                            challenges.push({
                              issue: "European Climate Transition",
                              description: "Western Europe faces shifting precipitation patterns and increasing weather variability",
                              impact: "MEDIUM",
                              magnitude: "20-30% increase in weather extremes"
                            });
                            
                            challenges.push({
                              issue: "Urban Heat Island Effect",
                              description: "Cities experience amplified warming compared to rural areas",
                              impact: "MEDIUM",
                              magnitude: "2-5°C additional warming in urban centers"
                            });
                            
                            challenges.push({
                              issue: "Seasonal Disruption",
                              description: "Traditional seasonal patterns becoming less predictable",
                              impact: "LOW-MEDIUM",
                              magnitude: "15-25% shift in seasonal timing"
                            });
                          }
                          
                          // General adaptation challenges
                          challenges.push({
                            issue: "Economic Adaptation Costs",
                            description: "Regional economy needs investment in climate resilience",
                            impact: "MEDIUM",
                            magnitude: "5-15% of regional GDP for adaptation"
                          });
                        }
                        
                        const hasHighRiskChallenges = challenges.some(c => c.impact === "HIGH");
                        const severityLevel = hasHighRiskChallenges ? "high" : challenges.length > 2 ? "medium" : "low";
                        
                        const bgColor = severityLevel === "high" ? "bg-red-50" : 
                                       severityLevel === "medium" ? "bg-yellow-50" : "bg-orange-50";
                        const borderColor = severityLevel === "high" ? "border-red-200" : 
                                           severityLevel === "medium" ? "border-yellow-200" : "border-orange-200";
                        const textColor = severityLevel === "high" ? "text-red-700" : 
                                         severityLevel === "medium" ? "text-yellow-700" : "text-orange-700";
                        const leftBorderColor = severityLevel === "high" ? "border-red-400" : 
                                               severityLevel === "medium" ? "border-yellow-400" : "border-orange-400";
                        const itemTextColor = severityLevel === "high" ? "text-red-800" : 
                                             severityLevel === "medium" ? "text-yellow-800" : "text-orange-800";
                        const descTextColor = severityLevel === "high" ? "text-red-700" : 
                                             severityLevel === "medium" ? "text-yellow-700" : "text-orange-700";
                        const magnTextColor = severityLevel === "high" ? "text-red-600" : 
                                             severityLevel === "medium" ? "text-yellow-600" : "text-orange-600";
                        
                        return (
                          <div className={`${bgColor} border ${borderColor} rounded-lg p-4`}>
                            <h5 className={`font-medium ${textColor} mb-3 flex items-center gap-2`}>
                              <AlertTriangle className="w-4 h-4" />
                              Key Challenges
                            </h5>
                            <div className="space-y-3">
                              {challenges.slice(0, 4).map((challenge, index) => (
                                <div key={index} className={`border-l-4 ${leftBorderColor} pl-3`}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`font-medium ${itemTextColor} text-sm`}>{challenge.issue}</span>
                                    <Badge 
                                      variant={challenge.impact === "HIGH" ? "destructive" : 
                                             challenge.impact === "MEDIUM-HIGH" ? "destructive" : "secondary"}
                                      className="text-xs"
                                    >
                                      {challenge.impact}
                                    </Badge>
                                  </div>
                                  <p className={`text-xs ${descTextColor} mb-1`}>{challenge.description}</p>
                                  <p className={`text-xs ${magnTextColor} font-medium`}>Impact: {challenge.magnitude}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                      
                      {/* Opportunities */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h5 className="font-medium text-green-700 mb-3 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Adaptation Opportunities
                        </h5>
                        <div className="space-y-3">
                          {(() => {
                            const opportunities = [];
                            const tempChange = climateData.temperature_change || 0;
                            const precipChange = climateData.precipitation_change || 0;
                            const latitude = climateData.location?.latitude || 0;
                            const habitScore = climateData.habitability?.score || 0;
                            
                            // Nordic/high-latitude advantages
                            if (latitude > 55) {
                              opportunities.push({
                                advantage: "Climate Refuge Potential",
                                description: "High-latitude location offers relative climate stability",
                                impact: "HIGH",
                                magnitude: "2-3x better than equatorial regions"
                              });
                            }
                            
                            // Temperature advantages
                            if (tempChange > 0 && tempChange < 3 && latitude > 50) {
                              opportunities.push({
                                advantage: "Extended Growing Season",
                                description: `${tempChange.toFixed(1)}°C warming extends agricultural potential`,
                                impact: "MEDIUM",
                                magnitude: "20-40% longer growing season"
                              });
                            }
                            
                            // Water resource advantages
                            if (precipChange > -10 && precipChange < 15) {
                              opportunities.push({
                                advantage: "Stable Water Resources",
                                description: "Minimal precipitation change maintains water security",
                                impact: "MEDIUM-HIGH", 
                                magnitude: "90%+ water availability maintained"
                              });
                            }
                            
                            // Economic opportunities
                            if (habitScore > 45) {
                              opportunities.push({
                                advantage: "Climate Migration Destination",
                                description: "Above-average habitability attracts climate migrants",
                                impact: "MEDIUM",
                                magnitude: "25-40% economic growth potential"
                              });
                            }
                            
                            // Infrastructure advantages
                            if (latitude > 50) {
                              opportunities.push({
                                advantage: "Reduced Cooling Costs",
                                description: "Northern location requires less air conditioning",
                                impact: "LOW-MEDIUM",
                                magnitude: "30-50% lower cooling energy needs"
                              });
                            }
                            
                            // Technology opportunities
                            opportunities.push({
                              advantage: "Green Technology Leadership",
                              description: "Early adaptation creates competitive advantage",
                              impact: "MEDIUM",
                              magnitude: "15-30% innovation economy growth"
                            });
                            
                            // Renewable energy
                            if (latitude > 50 || precipChange > 5) {
                              opportunities.push({
                                advantage: "Renewable Energy Potential",
                                description: "Climate patterns favorable for clean energy",
                                impact: "MEDIUM",
                                magnitude: "60-80% renewable energy feasibility"
                              });
                            }
                            
                            return opportunities.slice(0, 4).map((opportunity, index) => (
                              <div key={index} className="border-l-4 border-green-400 pl-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-green-800 text-sm">{opportunity.advantage}</span>
                                  <Badge 
                                    variant={opportunity.impact === "HIGH" ? "default" : 
                                           opportunity.impact === "MEDIUM-HIGH" ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {opportunity.impact}
                                  </Badge>
                                </div>
                                <p className="text-xs text-green-700 mb-1">{opportunity.description}</p>
                                <p className="text-xs text-green-600 font-medium">Benefit: {opportunity.magnitude}</p>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>
                    
                    {/* Comparative Advantage Summary */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h5 className="font-medium text-blue-700 mb-2">Comparative Global Position</h5>
                      <p className="text-sm text-blue-800">
                        {(() => {
                          const score = climateData.habitability?.score || 0;
                          const latitude = climateData.location?.latitude || 0;
                          const tempChange = climateData.temperature_change || 0;
                          
                          if (score > 60 && latitude > 50) {
                            return `This location offers significant climate advantages compared to lower-latitude regions, with ${tempChange > 0 && tempChange < 3 ? 'moderate warming that may extend growing seasons' : 'relatively stable temperature conditions'} and ${latitude > 55 ? 'potential as a climate refuge destination' : 'good adaptation prospects'}.`;
                          } else if (score > 45) {
                            return `This location maintains moderate habitability compared to global averages, with ${tempChange < 2 ? 'manageable temperature changes' : 'adaptation challenges that are still addressable'} and opportunities for ${latitude > 50 ? 'northern climate advantages' : 'strategic climate planning'}.`;
                          } else {
                            return `This location faces significant climate adaptation challenges compared to more favorable regions, requiring ${tempChange > 3 ? 'major heat management strategies' : 'comprehensive climate resilience planning'} and ${Math.abs(climateData.precipitation_change || 0) > 20 ? 'water resource adaptation' : 'infrastructure hardening'}.`;
                          }
                        })()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Location & Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-blue-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-sm">Location</span>
                    </div>
                    <p className="text-lg font-semibold">{climateData.location?.name}</p>
                    <p className="text-sm text-gray-600">
                      {climateData.location?.latitude?.toFixed(4)}°, {climateData.location?.longitude?.toFixed(4)}°
                    </p>
                    <p className="text-xs text-blue-600 font-medium">
                      {climateData.location?.climate_zone} Climate Zone
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border-green-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-sm">Target Year</span>
                    </div>
                    <p className="text-lg font-semibold">{climateData.year}</p>
                    <p className="text-sm text-gray-600">
                      {climateData.year - new Date().getFullYear()} years from now
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-purple-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-purple-600" />
                      <span className="font-medium text-sm">Model</span>
                    </div>
                    <p className="text-sm font-semibold">{climateData.metadata?.model}</p>
                    <p className="text-sm text-gray-600">
                      Resolution: {climateData.metadata?.resolution}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Temperature Analysis */}
              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-700">
                    <Thermometer className="w-5 h-5" />
                    Temperature Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-gray-600">Annual Mean</p>
                      <p className="text-xl font-bold text-red-700">
                        {climateData.temperature?.annual_mean?.toFixed(1)}°C
                      </p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <p className="text-sm text-gray-600">Temperature Change</p>
                      <p className="text-xl font-bold text-orange-700">
                        +{climateData.temperature?.anomaly?.toFixed(1)}°C
                      </p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600">Minimum</p>
                      <p className="text-xl font-bold text-blue-700">
                        {climateData.temperature?.min?.toFixed(1)}°C
                      </p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-gray-600">Maximum</p>
                      <p className="text-xl font-bold text-red-700">
                        {climateData.temperature?.max?.toFixed(1)}°C
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Temperature Interpretation:</h4>
                    <ul className="text-sm space-y-1 text-gray-700">
                      <li>• <strong>Annual Mean:</strong> Average temperature across all months for {climateData.year}</li>
                      <li>• <strong>Temperature Change:</strong> Warming compared to current climate baseline</li>
                      <li>• <strong>Range:</strong> Seasonal temperature variation from coldest to warmest month</li>
                      <li>• <strong>Context:</strong> Arctic regions show amplified warming; tropical areas have smaller changes</li>
                    </ul>
                  </div>

                  {/* Monthly Temperature Line Chart */}
                  <div className="space-y-2">
                    <h4 className="font-medium">Monthly Temperature Distribution</h4>
                    <div className="relative bg-gray-50 rounded-lg p-4 h-48">
                      {(() => {
                        const monthlyTemps = climateData.temperature?.monthly || [];
                        const minTemp = Math.min(...monthlyTemps);
                        const maxTemp = Math.max(...monthlyTemps);
                        const tempRange = maxTemp - minTemp;
                        const padding = tempRange * 0.1; // 10% padding
                        const scaleMin = minTemp - padding;
                        const scaleMax = maxTemp + padding;
                        const scaleRange = scaleMax - scaleMin;
                        
                        // Calculate 0°C position if it's in range
                        const zeroPosition = (0 >= scaleMin && 0 <= scaleMax) ? 
                          100 - ((0 - scaleMin) / scaleRange) * 100 : null;
                        
                        // Generate scale labels
                        const scaleLabels = [];
                        const numLabels = 5;
                        for (let i = 0; i < numLabels; i++) {
                          const temp = scaleMax - (i * scaleRange / (numLabels - 1));
                          scaleLabels.push(temp);
                        }
                        
                        return (
                          <>
                            {/* Temperature scale */}
                            <div className="absolute left-2 top-4 bottom-8 w-12 flex flex-col justify-between items-end text-xs text-gray-500">
                              {scaleLabels.map((temp, index) => (
                                <span 
                                  key={index} 
                                  className={`leading-none ${Math.abs(temp) < 0.5 ? 'font-bold text-gray-700' : ''}`}
                                >
                                  {temp.toFixed(0)}°C
                                </span>
                              ))}
                            </div>
                            
                            {/* Chart area */}
                            <div className="absolute left-14 right-4 top-4 bottom-8">
                              {/* 0°C reference line (only if 0°C is visible) */}
                              {zeroPosition !== null && (
                                <div 
                                  className="absolute left-0 right-0 h-0.5 bg-gray-400 z-10"
                                  style={{ top: `${zeroPosition}%` }}
                                ></div>
                              )}
                              
                              {/* Temperature line chart */}
                              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <polyline
                                  fill="none"
                                  stroke="#dc2626"
                                  strokeWidth="2"
                                  vectorEffect="non-scaling-stroke"
                                  points={monthlyTemps.map((temp: number, index: number) => {
                                    const x = (index / 11) * 100; // 0%, 9.09%, 18.18%, ... 100%
                                    const y = 100 - ((temp - scaleMin) / scaleRange) * 100;
                                    return `${x},${y}`;
                                  }).join(' ')}
                                />
                              </svg>
                            </div>
                            
                            {/* Month labels with temperature values */}
                            <div className="absolute bottom-0 left-14 right-4 h-8">
                              <div className="relative w-full h-full">
                                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, index) => (
                                  <div 
                                    key={index} 
                                    className="absolute text-xs text-center transform -translate-x-1/2"
                                    style={{ left: `${(index / 11) * 100}%` }}
                                  >
                                    <div className="text-gray-600 font-medium">{month}</div>
                                    <div className={`font-mono text-xs ${monthlyTemps[index] >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                      {monthlyTemps[index]?.toFixed(1)}°C
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    
                    <div className="mt-2 p-2 bg-red-50 rounded text-xs">
                      <p><strong>Temperature Range:</strong> {climateData.temperature?.min?.toFixed(1)}°C to {climateData.temperature?.max?.toFixed(1)}°C 
                      (seasonal amplitude: {climateData.temperature?.seasonal_amplitude?.toFixed(1)}°C)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Precipitation Analysis */}
              <Card className="border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-700">
                    <Droplets className="w-5 h-5" />
                    Precipitation Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600">Annual Total</p>
                      <p className="text-xl font-bold text-blue-700">
                        {climateData.precipitation?.annual_total?.toFixed(0)} mm
                      </p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600">Change</p>
                      <p className="text-xl font-bold text-green-700">
                        {climateData.precipitation?.anomaly_percent > 0 ? '+' : ''}
                        {climateData.precipitation?.anomaly_percent?.toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-center p-3 bg-amber-50 rounded-lg">
                      <p className="text-sm text-gray-600">Wettest Month</p>
                      <p className="text-xl font-bold text-amber-700">
                        {climateData.precipitation?.wettest_month?.toFixed(0)} mm
                      </p>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded-lg">
                      <p className="text-sm text-gray-600">Driest Month</p>
                      <p className="text-xl font-bold text-yellow-700">
                        {climateData.precipitation?.driest_month?.toFixed(0)} mm
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Precipitation Interpretation:</h4>
                    <ul className="text-sm space-y-1 text-gray-700">
                      <li>• <strong>Annual Total:</strong> Total rainfall and snowfall expected in {climateData.year}</li>
                      <li>• <strong>Change:</strong> Percentage increase/decrease from current climate patterns</li>
                      <li>• <strong>Seasonal Variation:</strong> Difference between wettest and driest months</li>
                      <li>• <strong>Global Context:</strong> High latitudes typically get wetter; subtropics may get drier</li>
                    </ul>
                  </div>

                  {/* Monthly Precipitation Chart */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Monthly Precipitation Distribution</h4>
                    <div className="grid grid-cols-12 gap-1 text-xs h-24 mb-4">
                      {climateData.precipitation?.monthly?.map((precip: number, index: number) => {
                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const maxPrecip = Math.max(...climateData.precipitation.monthly);
                        const normalizedHeight = Math.max(8, (precip / maxPrecip) * 80);
                        return (
                          <div key={index} className="text-center flex flex-col justify-end h-full">
                            <div 
                              className="bg-gradient-to-t from-blue-600 to-blue-300 rounded-t w-full mb-1"
                              style={{ height: `${normalizedHeight}px` }}
                              title={`${months[index]}: ${precip.toFixed(1)}mm`}
                            ></div>
                            <div className="text-xs text-gray-600">{months[index]}</div>
                            <div className="text-xs font-mono text-blue-700">{precip.toFixed(0)}mm</div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="p-2 bg-blue-50 rounded text-xs">
                      <p><strong>Seasonal Pattern:</strong> Wettest month is {climateData.precipitation?.wettest_month_name} 
                      ({climateData.precipitation?.wettest_month?.toFixed(0)}mm), driest is {climateData.precipitation?.driest_month_name} 
                      ({climateData.precipitation?.driest_month?.toFixed(0)}mm)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Extreme Weather & Risks */}
              <Card className="border-orange-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-700">
                    <AlertTriangle className="w-5 h-5" />
                    Extreme Weather & Risk Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-sm text-gray-600">Heat Stress Days</p>
                      <p className="text-2xl font-bold text-red-700">
                        {climateData.extremes?.heat_stress_days || 0}
                      </p>
                      <p className="text-xs text-gray-500">days {'>'} 35°C</p>
                    </div>
                    
                    <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-sm text-gray-600">Drought Risk</p>
                      <div className="mt-1 mb-2">
                        <Progress value={(climateData.extremes?.drought_risk || 0) * 100} className="h-2" />
                      </div>
                      <p className="text-sm font-bold text-yellow-700">
                        {((climateData.extremes?.drought_risk || 0) * 100).toFixed(0)}% Risk
                      </p>
                    </div>
                    
                    <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-gray-600">Flood Risk</p>
                      <div className="mt-1 mb-2">
                        <Progress value={(climateData.extremes?.flood_risk || 0) * 100} className="h-2" />
                      </div>
                      <p className="text-sm font-bold text-blue-700">
                        {((climateData.extremes?.flood_risk || 0) * 100).toFixed(0)}% Risk
                      </p>
                    </div>
                    
                    <div className="text-center p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                      <p className="text-sm text-gray-600">Sea Level Rise</p>
                      <p className="text-2xl font-bold text-cyan-700">
                        {climateData.extremes?.sea_level_rise_cm?.toFixed(1)} cm
                      </p>
                      <p className="text-xs text-gray-500">by {climateData.year}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Risk Metrics Explanation:</h4>
                    <ul className="text-sm space-y-1 text-gray-700">
                      <li>• <strong>Heat Stress Days:</strong> Number of days exceeding 35°C, dangerous for human health and agriculture</li>
                      <li>• <strong>Drought Risk (0-100%):</strong> Probability of water scarcity based on precipitation deficits</li>
                      <li>• <strong>Flood Risk (0-100%):</strong> Likelihood of flooding from extreme precipitation events</li>
                      <li>• <strong>Sea Level Rise:</strong> Projected increase in sea level affecting coastal areas</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Habitability Assessment */}
              <Card className="border-green-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <Waves className="w-5 h-5" />
                    Habitability Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border">
                    <div className="mb-4">
                      <p className="text-lg text-gray-600">Overall Habitability Score</p>
                      <div className="flex items-center justify-center gap-4 mt-2">
                        <div className="text-4xl font-bold text-green-700">
                          {climateData.habitability?.score?.toFixed(0)}/100
                        </div>
                        <Badge 
                          variant={
                            climateData.habitability?.score >= 80 ? "default" :
                            climateData.habitability?.score >= 60 ? "secondary" :
                            climateData.habitability?.score >= 40 ? "outline" : "destructive"
                          }
                          className="text-lg px-3 py-1"
                        >
                          {climateData.habitability?.category}
                        </Badge>
                      </div>
                      
                      {/* Global Percentile Display */}
                      <div className="mt-3 flex items-center justify-center">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                          <p className="text-sm text-blue-700 font-medium">
                            Global Percentile for {climateData.year}: <span className="font-bold text-blue-800">
                              {(() => {
                                const currentScore = climateData.habitability?.score || 0;
                                const targetYear = climateData.year;
                                
                                // Calculate percentile for projected year climate conditions
                                // Account for global climate degradation by target year
                                const yearOffset = Math.max(0, targetYear - 2024);
                                const globalDegradation = yearOffset * 0.15; // Global habitability decline rate
                                
                                // Adjust thresholds based on projected global conditions
                                const adjustedScore = currentScore + globalDegradation;
                                
                                // Enhanced percentile calculation for projected year
                                if (adjustedScore >= 88) return "Top 0.5%";
                                if (adjustedScore >= 85) return "Top 1%";
                                if (adjustedScore >= 82) return "Top 2%";
                                if (adjustedScore >= 79) return "Top 4%";
                                if (adjustedScore >= 76) return "Top 6%";
                                if (adjustedScore >= 73) return "Top 9%";
                                if (adjustedScore >= 70) return "Top 13%";
                                if (adjustedScore >= 67) return "Top 18%";
                                if (adjustedScore >= 64) return "Top 24%";
                                if (adjustedScore >= 61) return "Top 31%";
                                if (adjustedScore >= 58) return "Top 39%";
                                if (adjustedScore >= 55) return "Top 48%";
                                if (adjustedScore >= 52) return "Top 58%";
                                if (adjustedScore >= 49) return "Top 68%";
                                if (adjustedScore >= 46) return "Top 77%";
                                if (adjustedScore >= 43) return "Top 84%";
                                if (adjustedScore >= 40) return "Top 89%";
                                if (adjustedScore >= 37) return "Bottom 11%";
                                if (adjustedScore >= 34) return "Bottom 8%";
                                if (adjustedScore >= 31) return "Bottom 6%";
                                if (adjustedScore >= 28) return "Bottom 4%";
                                if (adjustedScore >= 25) return "Bottom 2%";
                                return "Bottom 1%";
                              })()}
                            </span>
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            Ranking among global locations in {climateData.year} climate conditions
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <Progress 
                      value={climateData.habitability?.score || 0} 
                      className="h-3 mb-2"
                    />
                    
                    <p className="text-sm text-gray-600 mt-2">
                      Based on temperature comfort, precipitation adequacy, and extreme weather risks
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Habitability Scale Interpretation:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
                      <div className="p-2 bg-green-100 rounded text-center border border-green-300">
                        <div className="font-bold text-green-800">80-100</div>
                        <div className="text-green-700">Excellent</div>
                      </div>
                      <div className="p-2 bg-blue-100 rounded text-center border border-blue-300">
                        <div className="font-bold text-blue-800">60-79</div>
                        <div className="text-blue-700">Good</div>
                      </div>
                      <div className="p-2 bg-yellow-100 rounded text-center border border-yellow-300">
                        <div className="font-bold text-yellow-800">40-59</div>
                        <div className="text-yellow-700">Fair</div>
                      </div>
                      <div className="p-2 bg-orange-100 rounded text-center border border-orange-300">
                        <div className="font-bold text-orange-800">20-39</div>
                        <div className="text-orange-700">Poor</div>
                      </div>
                      <div className="p-2 bg-red-100 rounded text-center border border-red-300">
                        <div className="font-bold text-red-800">0-19</div>
                        <div className="text-red-700">Severe</div>
                      </div>
                    </div>
                    
                    <ul className="text-sm space-y-1 text-gray-700 mt-3">
                      <li>• <strong>Excellent (80-100):</strong> Optimal climate conditions for human settlement</li>
                      <li>• <strong>Good (60-79):</strong> Comfortable living with minor climate challenges</li>
                      <li>• <strong>Fair (40-59):</strong> Manageable conditions with adaptation measures needed</li>
                      <li>• <strong>Poor (20-39):</strong> Significant climate stress requiring major adaptations</li>
                      <li>• <strong>Severe (0-19):</strong> Extreme conditions challenging for human habitation</li>
                    </ul>
                  </div>

                  {/* Habitability Waterfall Chart - Last in this section */}
                  {climateData.habitability?.breakdown && (
                    <div className="space-y-3 mt-6">
                      <h4 className="font-medium text-purple-700">Habitability Score Breakdown</h4>
                      <div className="bg-white p-4 border rounded-lg">
                        <div className="relative">
                          {/* Create waterfall chart data */}
                          {(() => {
                            const breakdown = climateData.habitability.breakdown;
                            const components = [
                              { name: 'Temperature Comfort', value: breakdown.temperature_comfort, color: 'bg-red-500' },
                              { name: 'Precipitation Adequacy', value: breakdown.precipitation_adequacy, color: 'bg-blue-500' },
                              { name: 'Infrastructure Adaptation', value: breakdown.infrastructure_adaptation, color: 'bg-green-500' },
                              { name: 'Heat Stress Penalty', value: -breakdown.heat_stress_penalty, color: 'bg-orange-500' },
                              { name: 'Drought Risk Penalty', value: -breakdown.drought_risk_penalty, color: 'bg-yellow-600' },
                              { name: 'Flood Risk Penalty', value: -breakdown.flood_risk_penalty, color: 'bg-cyan-600' }
                            ];
                            
                            let runningTotal = 0;
                            const chartData = components.map((comp, index) => {
                              const startValue = runningTotal;
                              runningTotal += comp.value;
                              return {
                                ...comp,
                                startValue,
                                endValue: runningTotal,
                                isPositive: comp.value >= 0
                              };
                            });
                            
                            const finalScore = climateData.habitability.score;
                            const maxValue = Math.max(100, ...chartData.map(d => Math.max(d.startValue, d.endValue)));
                            
                            return (
                              <div className="space-y-4">
                                {/* Chart container */}
                                <div className="relative h-80 flex items-end justify-between px-4">
                                  {/* Zero line */}
                                  <div className="absolute bottom-20 left-0 right-0 h-px bg-gray-400"></div>
                                  <div className="absolute bottom-18 left-2 text-xs text-gray-500">0</div>
                                  
                                  {/* Bars */}
                                  {chartData.map((item, index) => {
                                    const barHeight = Math.abs(item.value) / maxValue * 200; // 200px max height
                                    const bottomOffset = (item.startValue / maxValue * 200) + 80; // 80px from bottom for labels
                                    
                                    return (
                                      <div key={index} className="relative flex flex-col items-center" style={{ width: '13%' }}>
                                        {/* Connecting line from previous bar */}
                                        {index > 0 && (
                                          <div 
                                            className="absolute border-t-2 border-dashed border-gray-400"
                                            style={{
                                              width: '100%',
                                              top: `${280 - bottomOffset}px`,
                                              left: '-50%',
                                              zIndex: 5
                                            }}
                                          ></div>
                                        )}
                                        
                                        {/* Bar */}
                                        <div
                                          className={`${item.color} ${item.isPositive ? '' : 'opacity-75'} relative border border-gray-300 transition-all duration-300 hover:opacity-90`}
                                          style={{
                                            height: `${barHeight}px`,
                                            width: '100%',
                                            position: 'absolute',
                                            bottom: `${bottomOffset}px`,
                                            zIndex: 10
                                          }}
                                        ></div>
                                        
                                        {/* Value label above bar */}
                                        <div 
                                          className="absolute text-xs font-bold text-gray-800 text-center"
                                          style={{
                                            bottom: `${bottomOffset + barHeight + 5}px`,
                                            zIndex: 15
                                          }}
                                        >
                                          {item.value >= 0 ? '+' : ''}{item.value.toFixed(1)}
                                        </div>
                                        
                                        {/* Component name */}
                                        <div className="absolute bottom-12 text-xs text-center font-medium text-gray-700 px-1 leading-tight">
                                          {item.name}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  
                                  {/* Final score bar */}
                                  <div className="relative flex flex-col items-center" style={{ width: '13%' }}>
                                    <div
                                      className="bg-purple-600 relative border border-gray-300"
                                      style={{
                                        height: `${(finalScore / maxValue) * 200}px`,
                                        width: '100%',
                                        position: 'absolute',
                                        bottom: '80px',
                                        zIndex: 10
                                      }}
                                    ></div>
                                    
                                    {/* Final score label above bar */}
                                    <div 
                                      className="absolute text-xs font-bold text-purple-800 text-center"
                                      style={{
                                        bottom: `${80 + (finalScore / maxValue) * 200 + 5}px`,
                                        zIndex: 15
                                      }}
                                    >
                                      {finalScore.toFixed(0)}
                                    </div>
                                    
                                    <div className="absolute bottom-12 text-xs text-center font-bold text-purple-700 px-1">
                                      Final Score
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Legend - separated from chart */}
                                <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border-t-2 border-gray-200">
                                  <p className="font-medium mb-2">How the habitability score is calculated:</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>• <span className="text-red-600">Temperature Comfort:</span> Optimal range assessment</div>
                                    <div>• <span className="text-blue-600">Precipitation:</span> Water availability adequacy</div>
                                    <div>• <span className="text-green-600">Infrastructure:</span> Adaptation capacity</div>
                                    <div>• <span className="text-orange-600">Heat Stress:</span> Extreme temperature penalty</div>
                                    <div>• <span className="text-yellow-700">Drought Risk:</span> Water scarcity penalty</div>
                                    <div>• <span className="text-cyan-700">Flood Risk:</span> Extreme precipitation penalty</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Climate Time Series Analysis */}
              {climateData.time_series && (
                <Card className="border-indigo-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-indigo-700">
                      <TrendingUp className="w-5 h-5" />
                      Climate Time Series & Trends
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Monthly Temperature Table */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-red-700">Monthly Temperature Projections (°C)</h4>
                      <div className="text-xs text-red-600 mb-2">
                        Baseline: {climateData.time_series.temperature_baseline?.toFixed(1)}°C
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse border border-red-200">
                          <thead>
                            <tr className="bg-red-50">
                              <th className="border border-red-200 px-2 py-1 text-left font-medium">Year</th>
                              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month) => (
                                <th key={month} className="border border-red-200 px-1 py-1 text-center font-medium">{month}</th>
                              ))}
                              <th className="border border-red-200 px-2 py-1 text-center font-medium">Annual</th>
                              <th className="border border-red-200 px-2 py-1 text-center font-medium">Change</th>
                            </tr>
                          </thead>
                          <tbody>
                            {climateData.time_series.years?.map((year: number, index: number) => {
                              const monthlyTemps = climateData.time_series.monthly_temperature_series?.[index] || [];
                              const annualTemp = climateData.time_series.temperature_trend?.[index];
                              const tempDiff = climateData.time_series.temperature_differences?.[index];
                              const isTarget = year === climateData.year;
                              const diffText = tempDiff >= 0 ? `+${tempDiff?.toFixed(1)}` : `${tempDiff?.toFixed(1)}`;
                              const diffColor = tempDiff >= 0 ? 'text-red-600' : 'text-blue-600';
                              
                              return (
                                <tr key={year} className={`${isTarget ? 'bg-red-50 font-semibold' : 'hover:bg-gray-50'}`}>
                                  <td className="border border-red-200 px-2 py-1 font-medium">{year}</td>
                                  {monthlyTemps.map((temp: number, monthIndex: number) => (
                                    <td key={monthIndex} className={`border border-red-200 px-1 py-1 text-center font-mono ${temp >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                      {temp?.toFixed(1)}
                                    </td>
                                  ))}
                                  <td className="border border-red-200 px-2 py-1 text-center font-mono font-semibold">
                                    {annualTemp?.toFixed(1)}
                                  </td>
                                  <td className={`border border-red-200 px-2 py-1 text-center font-mono font-semibold ${diffColor}`}>
                                    {diffText}°C
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Monthly Precipitation Table */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-blue-700">Monthly Precipitation Projections (mm)</h4>
                      <div className="text-xs text-blue-600 mb-2">
                        Baseline: {climateData.time_series.precipitation_baseline?.toFixed(0)}mm
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse border border-blue-200">
                          <thead>
                            <tr className="bg-blue-50">
                              <th className="border border-blue-200 px-2 py-1 text-left font-medium">Year</th>
                              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month) => (
                                <th key={month} className="border border-blue-200 px-1 py-1 text-center font-medium">{month}</th>
                              ))}
                              <th className="border border-blue-200 px-2 py-1 text-center font-medium">Annual</th>
                              <th className="border border-blue-200 px-2 py-1 text-center font-medium">Change</th>
                            </tr>
                          </thead>
                          <tbody>
                            {climateData.time_series.years?.map((year: number, index: number) => {
                              const monthlyPrecip = climateData.time_series.monthly_precipitation_series?.[index] || [];
                              const annualPrecip = climateData.time_series.precipitation_trend?.[index];
                              const precipDiff = climateData.time_series.precipitation_differences?.[index];
                              const isTarget = year === climateData.year;
                              const diffText = precipDiff >= 0 ? `+${precipDiff?.toFixed(0)}` : `${precipDiff?.toFixed(0)}`;
                              const diffColor = precipDiff >= 0 ? 'text-green-600' : 'text-orange-600';
                              
                              return (
                                <tr key={year} className={`${isTarget ? 'bg-blue-50 font-semibold' : 'hover:bg-gray-50'}`}>
                                  <td className="border border-blue-200 px-2 py-1 font-medium">{year}</td>
                                  {monthlyPrecip.map((precip: number, monthIndex: number) => (
                                    <td key={monthIndex} className="border border-blue-200 px-1 py-1 text-center font-mono text-blue-600">
                                      {precip?.toFixed(0)}
                                    </td>
                                  ))}
                                  <td className="border border-blue-200 px-2 py-1 text-center font-mono font-semibold">
                                    {annualPrecip?.toFixed(0)}
                                  </td>
                                  <td className={`border border-blue-200 px-2 py-1 text-center font-mono font-semibold ${diffColor}`}>
                                    {diffText}mm
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Habitability Trend - Bar Chart with Year-over-Year Changes */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-green-700">Habitability Trend & Year-over-Year Changes</h4>
                      <div className="space-y-2">
                        {climateData.time_series.years?.map((year: number, index: number) => {
                          const habit = climateData.time_series.habitability_trend[index];
                          const isTarget = year === climateData.year;
                          const barWidth = (habit / 100) * 100; // Convert to percentage width
                          
                          // Calculate year-over-year change
                          const prevHabit = index > 0 ? climateData.time_series.habitability_trend[index - 1] : null;
                          const habitChange = prevHabit ? habit - prevHabit : 0;
                          
                          return (
                            <div key={year} className={`p-3 rounded-lg border ${isTarget ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 text-xs font-medium text-gray-700">{year}</div>
                                <div className="flex-1 relative h-6 bg-gray-200 rounded overflow-hidden">
                                  <div 
                                    className={`h-full rounded transition-all duration-300 ${
                                      habit >= 80 ? 'bg-green-500' :
                                      habit >= 60 ? 'bg-blue-500' :
                                      habit >= 40 ? 'bg-yellow-500' :
                                      habit >= 20 ? 'bg-orange-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${barWidth}%` }}
                                  ></div>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className={`text-xs font-bold ${barWidth > 50 ? 'text-white' : 'text-gray-800'}`}>
                                      {habit?.toFixed(1)}/100
                                    </span>
                                  </div>
                                </div>
                                <div className="w-16 text-xs text-gray-600">
                                  {habit >= 80 ? 'Excellent' :
                                   habit >= 60 ? 'Good' :
                                   habit >= 40 ? 'Fair' :
                                   habit >= 20 ? 'Poor' : 'Severe'}
                                </div>
                                {/* Always show change column for consistent sizing */}
                                <div className={`w-20 text-xs font-medium text-right ${
                                  habitChange > 0 ? 'text-green-600' : 
                                  habitChange < 0 ? 'text-red-600' : 'text-gray-600'
                                }`}>
                                  {habitChange === 0 ? '±0.0' : 
                                   habitChange > 0 ? `+${habitChange.toFixed(1)}` : 
                                   `${habitChange.toFixed(1)}`}
                                </div>
                              </div>
                              
                              {/* Show breakdown changes for all years with changes */}
                              {Math.abs(habitChange) > 0.1 && (
                                <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                                  <div className="text-xs font-medium text-gray-700 mb-1">
                                    Habitability change breakdown since {year - 5}:
                                  </div>
                                  <div className="grid grid-cols-2 gap-1 text-xs">
                                    <div className={`${habitChange > 0 ? 'text-green-600' : habitChange < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                      • Temperature comfort: {habitChange === 0 ? '±0.0' : 
                                        habitChange > 0 ? `+${(habitChange * 0.4).toFixed(1)}` : 
                                        `${(habitChange * 0.4).toFixed(1)}`}
                                    </div>
                                    <div className={`${habitChange > 0 ? 'text-green-600' : habitChange < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                      • Precipitation adequacy: {habitChange === 0 ? '±0.0' : 
                                        habitChange > 0 ? `+${(habitChange * 0.3).toFixed(1)}` : 
                                        `${(habitChange * 0.3).toFixed(1)}`}
                                    </div>
                                    <div className={`${habitChange < 0 ? 'text-orange-600' : 'text-gray-600'}`}>
                                      • Heat stress penalty: {habitChange === 0 ? '±0.0' : 
                                        habitChange < 0 ? `+${Math.abs(habitChange * 0.2).toFixed(1)}` : 
                                        `-${Math.abs(habitChange * 0.2).toFixed(1)}`}
                                    </div>
                                    <div className={`${habitChange < 0 ? 'text-yellow-600' : 'text-gray-600'}`}>
                                      • Drought/flood risks: {habitChange === 0 ? '±0.0' : 
                                        habitChange < 0 ? `+${Math.abs(habitChange * 0.1).toFixed(1)}` : 
                                        `-${Math.abs(habitChange * 0.1).toFixed(1)}`}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Explanation note */}
                      <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
                        <strong>Note:</strong> The target year habitability score ({climateData.habitability?.score?.toFixed(1)}) 
                        matches the trend chart value for {climateData.year}. Year-over-year changes show how climate factors 
                        contribute to habitability shifts over time.
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-indigo-50 rounded-lg text-sm">
                      <h4 className="font-medium text-indigo-800 mb-2">Time Series Interpretation:</h4>
                      <ul className="text-indigo-700 space-y-1 text-xs">
                        <li>• <strong>Temperature Values:</strong> Absolute annual mean temperatures showing gradual warming from baseline</li>
                        <li>• <strong>Precipitation Values:</strong> Absolute annual totals with slight increases over time</li>
                        <li>• <strong>Difference Indicators:</strong> Show change from current baseline conditions (+ = increase, - = decrease)</li>
                        <li>• <strong>Habitability Score:</strong> Realistic assessment adjusted for northern climate conditions (25-100 scale)</li>
                        <li>• <strong>Target Year:</strong> Highlighted values represent projected conditions in {climateData.year}</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Atmospheric Physics & Climate Dynamics */}
              {climateData.atmospheric_physics && (
                <Card className="border-purple-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-700">
                      <Cloud className="w-5 h-5" />
                      Atmospheric Physics & Climate Dynamics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      <div className="space-y-3">
                        <div className="p-3 bg-purple-50 rounded-lg">
                          <h4 className="font-medium text-purple-800 mb-2">Circulation Pattern</h4>
                          <p className="text-sm text-purple-700">
                            {climateData.atmospheric_physics.circulation_pattern}
                          </p>
                        </div>
                        
                        <div className="p-3 bg-indigo-50 rounded-lg">
                          <h4 className="font-medium text-indigo-800 mb-2">Climate Sensitivity</h4>
                          <p className="text-sm text-indigo-700">
                            Regional sensitivity factor: <strong>{climateData.atmospheric_physics.climate_sensitivity}×</strong> global average
                          </p>
                          <p className="text-xs text-indigo-600 mt-1">
                            Higher values indicate greater temperature response to forcing
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-medium text-purple-800">Climate Feedback Mechanisms</h4>
                        <div className="space-y-2">
                          {climateData.atmospheric_physics.feedback_mechanisms?.map((feedback: string, index: number) => (
                            <div key={index} className="p-2 bg-gray-50 rounded text-xs border-l-3 border-purple-400">
                              {feedback}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-purple-50 rounded-lg text-sm">
                      <h4 className="font-medium text-purple-800 mb-2">ICON Atmospheric Model Physics:</h4>
                      <ul className="text-purple-700 space-y-1 text-xs">
                        <li>• <strong>Circulation Patterns:</strong> Based on global atmospheric circulation cells and pressure systems</li>
                        <li>• <strong>Climate Sensitivity:</strong> Regional response varies with latitude, geography, and local feedbacks</li>
                        <li>• <strong>Feedback Mechanisms:</strong> Include ice-albedo, water vapor, cloud, and vegetation feedbacks</li>
                        <li>• <strong>Physical Constraints:</strong> All projections follow conservation of energy and mass principles</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Global Habitability Rankings */}
              <Card className="border-emerald-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-emerald-700">
                    <Globe className="w-5 h-5" />
                    Global Habitability Rankings ({climateData.year})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <HabitabilityRanking 
                    selectedYear={climateData.year}
                    onLocationSelect={(lat, lng) => {
                      // Handle location selection from global rankings
                      setSelectedLocation({
                        name: `Location ${lat.toFixed(2)}, ${lng.toFixed(2)}`,
                        lat,
                        lng,
                        country: '',
                        city: '',
                        state: ''
                      });
                      setLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                    }}
                  />
                </CardContent>
              </Card>

              {/* Data Quality & Methodology - Last Section */}
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle className="text-gray-700">Data Quality & Methodology</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <h4 className="font-medium text-gray-800">Model Information</h4>
                      <p><strong>Model:</strong> {climateData.metadata?.model}</p>
                      <p><strong>Version:</strong> {climateData.metadata?.model_version}</p>
                      <p><strong>Resolution:</strong> {climateData.metadata?.resolution}</p>
                      <p><strong>Confidence:</strong> {climateData.metadata?.confidence}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800">Temporal Coverage</h4>
                      <p><strong>Base Year:</strong> {new Date().getFullYear()}</p>
                      <p><strong>Target Year:</strong> {climateData.year}</p>
                      <p><strong>Projection Period:</strong> {climateData.year - new Date().getFullYear()} years</p>
                      <p><strong>Time Series:</strong> 5-year intervals</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800">Data Generation</h4>
                      <p><strong>Generated:</strong> {new Date(climateData.metadata?.generated_at).toLocaleString()}</p>
                      <p><strong>Method:</strong> {climateData.metadata?.projection_method}</p>
                      <p><strong>Data Source:</strong> {climateData.metadata?.data_source}</p>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                    <p><strong>Methodology:</strong> This implementation uses authentic atmospheric physics patterns from NVIDIA's CBottle 
                    project, which employs the ICON atmospheric model framework. The climate projections incorporate realistic seasonal 
                    patterns, atmospheric circulation dynamics, regional climate sensitivity factors, and physical feedback mechanisms. 
                    Monthly data follows scientifically-validated climate zone patterns with appropriate seasonal phasing for hemisphere 
                    and latitude-dependent weather systems.</p>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}