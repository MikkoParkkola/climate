import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Thermometer, Droplets, MapPin, TrendingUp, TrendingDown, AlertTriangle, Waves, Cloud } from "lucide-react";

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
              <CardTitle className="flex items-center gap-2">
                <Cloud className="w-6 h-6" />
                Climate Data Visualization Report
              </CardTitle>
              <p className="text-sm text-gray-600">
                Detailed analysis of climate projection data from CBottle local implementation
              </p>
            </CardHeader>
            <CardContent className="space-y-8">
              
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

                  {/* Monthly Temperature Chart */}
                  <div className="space-y-2">
                    <h4 className="font-medium">Monthly Temperature Distribution</h4>
                    <div className="grid grid-cols-12 gap-1 text-xs">
                      {climateData.temperature?.monthly?.map((temp: number, index: number) => {
                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const normalizedHeight = Math.max(10, Math.min(100, ((temp + 20) / 50) * 100));
                        return (
                          <div key={index} className="text-center">
                            <div 
                              className="bg-gradient-to-t from-red-500 to-blue-500 rounded-t mb-1"
                              style={{ height: `${normalizedHeight}px`, width: '100%' }}
                              title={`${months[index]}: ${temp.toFixed(1)}°C`}
                            ></div>
                            <div className="text-xs">{months[index]}</div>
                            <div className="text-xs font-mono">{temp.toFixed(1)}</div>
                          </div>
                        );
                      })}
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
                  <div className="space-y-2">
                    <h4 className="font-medium">Monthly Precipitation Distribution</h4>
                    <div className="grid grid-cols-12 gap-1 text-xs">
                      {climateData.precipitation?.monthly?.map((precip: number, index: number) => {
                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const maxPrecip = Math.max(...climateData.precipitation.monthly);
                        const normalizedHeight = Math.max(10, (precip / maxPrecip) * 80);
                        return (
                          <div key={index} className="text-center">
                            <div 
                              className="bg-gradient-to-t from-blue-600 to-blue-300 rounded-t mb-1"
                              style={{ height: `${normalizedHeight}px`, width: '100%' }}
                              title={`${months[index]}: ${precip.toFixed(1)}mm`}
                            ></div>
                            <div className="text-xs">{months[index]}</div>
                            <div className="text-xs font-mono">{precip.toFixed(0)}</div>
                          </div>
                        );
                      })}
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
                </CardContent>
              </Card>

              {/* Data Quality & Methodology */}
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle className="text-gray-700">Data Quality & Methodology</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <h4 className="font-medium text-gray-800">Model Information</h4>
                      <p><strong>Model:</strong> {climateData.metadata?.model}</p>
                      <p><strong>Resolution:</strong> {climateData.metadata?.resolution}</p>
                      <p><strong>Confidence:</strong> {climateData.metadata?.confidence}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800">Temporal Coverage</h4>
                      <p><strong>Base Year:</strong> {new Date().getFullYear()}</p>
                      <p><strong>Target Year:</strong> {climateData.year}</p>
                      <p><strong>Projection Period:</strong> {climateData.year - new Date().getFullYear()} years</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800">Data Generation</h4>
                      <p><strong>Generated:</strong> {new Date(climateData.metadata?.generated_at).toLocaleString()}</p>
                      <p><strong>Method:</strong> Physics-based downscaling</p>
                      <p><strong>Baseline:</strong> Observational climatology</p>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                    <p><strong>Note:</strong> This climate projection uses CBottle-inspired methodology with realistic physics-based calculations. 
                    Results include latitude-dependent temperature baselines, regional precipitation patterns, and climate change factors 
                    based on current scientific understanding. The habitability score integrates multiple climate factors to assess 
                    human comfort and livability.</p>
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