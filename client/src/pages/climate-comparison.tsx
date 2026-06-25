import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, X, Plus, BarChart3, TrendingUp, Thermometer, Droplets, Home, Globe, ArrowLeft } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import ComparisonCharts from "@/components/comparison-charts";

interface ClimateLocation {
  name: string;
  lat: number;
  lng: number;
  country: string;
  city: string;
}

interface ComparisonData {
  location: ClimateLocation;
  temperature: {
    annual_mean: number;
    change_from_baseline: number;
    min: number;
    max: number;
    monthly: number[];
  };
  precipitation: {
    annual_total: number;
    change_from_baseline: number;
    monthly: number[];
  };
  habitability: {
    score: number;
    breakdown: {
      temperature_comfort: number;
      precipitation_adequacy: number;
      infrastructure_adaptation: number;
      heat_stress_penalty: number;
      drought_risk_penalty: number;
      flood_risk_penalty: number;
    };
  };
  extremes: {
    heat_stress_days: number;
    drought_risk: number;
    flood_risk: number;
  };
  atmospheric_physics: {
    climate_zone: string;
    circulation_pattern: string;
    climate_sensitivity: number;
  };
}

interface ClimateComparisonProps {
  onBack: () => void;
}

export default function ClimateComparison({ onBack }: ClimateComparisonProps) {
  const [selectedLocations, setSelectedLocations] = useState<ClimateLocation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [targetYear, setTargetYear] = useState(2050);
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Get API configuration
  const { data: config } = useQuery({
    queryKey: ['/api/config'],
    staleTime: 10 * 60 * 1000,
  });

  const apiKey = (config as any)?.nvidiaApiKey;

  // Search for locations
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['/api/locations/search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const response = await fetch(`/api/locations/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Failed to search locations');
      return response.json();
    },
    enabled: searchQuery.length > 2,
    staleTime: 5 * 60 * 1000,
  });

  // Compare locations mutation
  const compareLocationsMutation = useMutation({
    mutationFn: async () => {
      if (!apiKey) {
        throw new Error("NVIDIA API key not configured. Please configure it in the main app first.");
      }

      const results: ComparisonData[] = [];
      
      for (const location of selectedLocations) {
        addLog(`Fetching climate data for ${location.name}...`);
        
        const response = await fetch('/api/climate-projection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: location.name,
            coordinates: { lat: location.lat, lng: location.lng },
            year: targetYear,
            apiKey: apiKey
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Failed to get data for ${location.name}: ${errorData.error || response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.data) {
          results.push({
            location,
            temperature: data.data.temperature,
            precipitation: data.data.precipitation,
            habitability: data.data.habitability,
            extremes: data.data.extremes,
            atmospheric_physics: data.data.atmospheric_physics
          });
          addLog(`✓ Data received for ${location.name}`);
        } else {
          throw new Error(`Invalid data format received for ${location.name}`);
        }
      }
      
      return results;
    },
    onSuccess: (data) => {
      setComparisonData(data);
      setIsComparing(false);
      addLog(`Comparison complete for ${data.length} locations`);
    },
    onError: (error) => {
      addLog(`Error: ${error}`);
      setIsComparing(false);
    }
  });

  const addLocation = (location: any) => {
    if (selectedLocations.length >= 10) {
      addLog("Maximum 10 locations allowed for comparison");
      return;
    }
    
    const newLocation: ClimateLocation = {
      name: location.name,
      lat: location.lat,
      lng: location.lng,
      country: location.country || '',
      city: location.city || ''
    };
    
    if (!selectedLocations.find(l => Math.abs(l.lat - newLocation.lat) < 0.01 && Math.abs(l.lng - newLocation.lng) < 0.01)) {
      setSelectedLocations([...selectedLocations, newLocation]);
      setSearchQuery("");
      addLog(`Added ${newLocation.name} to comparison`);
    }
  };

  const removeLocation = (index: number) => {
    const location = selectedLocations[index];
    setSelectedLocations(selectedLocations.filter((_, i) => i !== index));
    addLog(`Removed ${location.name} from comparison`);
  };

  const startComparison = () => {
    if (selectedLocations.length < 2) {
      addLog("Please select at least 2 locations for comparison");
      return;
    }
    
    if (!apiKey) {
      addLog("Error: NVIDIA API key not configured. Please set it up in the main app first.");
      return;
    }
    
    setIsComparing(true);
    addLog(`Starting comparison for ${selectedLocations.length} locations in ${targetYear}`);
    addLog(`Using API key: ${apiKey.substring(0, 10)}...`);
    compareLocationsMutation.mutate();
  };

  const getBounds = () => {
    if (selectedLocations.length === 0) return null;
    
    const lats = selectedLocations.map(l => l.lat);
    const lngs = selectedLocations.map(l => l.lng);
    
    return {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    };
  };

  const getHabitabilityColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-50";
    if (score >= 65) return "text-blue-600 bg-blue-50";
    if (score >= 50) return "text-yellow-600 bg-yellow-50";
    if (score >= 30) return "text-orange-600 bg-orange-50";
    return "text-red-600 bg-red-50";
  };

  const getHabitabilityLevel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 65) return "Good";
    if (score >= 50) return "Moderate";
    if (score >= 30) return "Poor";
    return "Critical";
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Single Location
                </Button>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-blue-600" />
                    Climate Location Comparison
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Compare climate projections for multiple locations side-by-side
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-lg px-3 py-1">
                {selectedLocations.length}/10 locations
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Location Selection */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Search and Add Locations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add Locations to Compare
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Search Input */}
              <div className="space-y-2">
                <Label htmlFor="location-search">Search for locations</Label>
                <Input
                  id="location-search"
                  placeholder="Search cities, countries, or coordinates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Search Results */}
              {isSearching && (
                <div className="text-sm text-gray-500">Searching...</div>
              )}
              
              {searchResults && searchResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {searchResults.slice(0, 10).map((result: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 cursor-pointer"
                      onClick={() => addLocation(result)}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="font-medium text-sm">{result.name}</div>
                          <div className="text-xs text-gray-500">
                            {result.lat?.toFixed(3)}, {result.lng?.toFixed(3)}
                          </div>
                        </div>
                      </div>
                      <Button size="sm" variant="outline">Add</Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Year Selection */}
              <div className="space-y-2">
                <Label>Target Year: {targetYear}</Label>
                <Slider
                  value={[targetYear]}
                  onValueChange={(value) => setTargetYear(value[0])}
                  min={2025}
                  max={2100}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>2025</span>
                  <span>2100</span>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Selected Locations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Selected Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              
              {selectedLocations.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MapPin className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p>No locations selected</p>
                  <p className="text-sm">Add 2-10 locations to start comparison</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedLocations.map((location, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        <div>
                          <div className="font-medium text-sm">{location.name}</div>
                          <div className="text-xs text-gray-500">
                            {location.lat.toFixed(3)}, {location.lng.toFixed(3)}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeLocation(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Compare Button */}
              <div className="mt-4 pt-4 border-t">
                <Button
                  onClick={startComparison}
                  disabled={selectedLocations.length < 2 || isComparing}
                  className="w-full"
                  size="lg"
                >
                  {isComparing ? 'Comparing...' : `Compare ${selectedLocations.length} Locations`}
                </Button>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {logs.slice(-10).map((log, index) => (
                  <div key={index} className="text-xs text-gray-600 font-mono">
                    {log}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comparison Results */}
        {comparisonData.length > 0 && (
          <>
            {/* Overview Map */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Comparison Overview Map - {targetYear}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center relative overflow-hidden">
                  {/* Simple coordinate-based map visualization */}
                  {(() => {
                    const bounds = getBounds();
                    if (!bounds) return null;
                    
                    const latRange = bounds.north - bounds.south || 1;
                    const lngRange = bounds.east - bounds.west || 1;
                    const padding = 0.1;
                    
                    return (
                      <div className="w-full h-full relative bg-blue-50">
                        {comparisonData.map((data, index) => {
                          const x = ((data.location.lng - bounds.west) / lngRange) * 80 + 10;
                          const y = ((bounds.north - data.location.lat) / latRange) * 80 + 10;
                          
                          return (
                            <div
                              key={index}
                              className="absolute transform -translate-x-1/2 -translate-y-1/2"
                              style={{ left: `${x}%`, top: `${y}%` }}
                            >
                              <div className={`w-6 h-6 rounded-full border-2 border-white shadow-lg ${getHabitabilityColor(data.habitability.score).replace('text-', 'bg-').replace('bg-', 'bg-')}`}></div>
                              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-medium whitespace-nowrap bg-white px-1 rounded shadow">
                                {data.location.name.split(',')[0]}
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* Legend */}
                        <div className="absolute bottom-2 right-2 bg-white p-2 rounded shadow text-xs">
                          <div className="font-medium mb-1">Habitability</div>
                          <div className="flex items-center gap-1 mb-1">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span>Excellent</span>
                          </div>
                          <div className="flex items-center gap-1 mb-1">
                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                            <span>Moderate</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <span>Critical</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Comparison Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Climate Data Comparison - {targetYear}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Location</th>
                        <th className="text-center p-2 font-medium">Avg Temp</th>
                        <th className="text-center p-2 font-medium">Temp Change</th>
                        <th className="text-center p-2 font-medium">Annual Precip</th>
                        <th className="text-center p-2 font-medium">Precip Change</th>
                        <th className="text-center p-2 font-medium">Habitability</th>
                        <th className="text-center p-2 font-medium">Heat Stress</th>
                        <th className="text-center p-2 font-medium">Climate Zone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonData.map((data, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="p-2">
                            <div className="font-medium">{data.location.name.split(',')[0]}</div>
                            <div className="text-xs text-gray-500">{data.location.country}</div>
                          </td>
                          <td className="text-center p-2">
                            <span className={data.temperature.annual_mean > 25 ? 'text-red-600' : data.temperature.annual_mean < 0 ? 'text-blue-600' : 'text-gray-900'}>
                              {data.temperature.annual_mean?.toFixed(1)}°C
                            </span>
                          </td>
                          <td className="text-center p-2">
                            <span className={data.temperature.change_from_baseline > 0 ? 'text-red-600' : 'text-gray-900'}>
                              {data.temperature.change_from_baseline > 0 ? '+' : ''}{data.temperature.change_from_baseline?.toFixed(1)}°C
                            </span>
                          </td>
                          <td className="text-center p-2">
                            <span className={data.precipitation.annual_total < 400 ? 'text-orange-600' : 'text-gray-900'}>
                              {data.precipitation.annual_total?.toFixed(0)}mm
                            </span>
                          </td>
                          <td className="text-center p-2">
                            <span className={data.precipitation.change_from_baseline > 0 ? 'text-blue-600' : 'text-orange-600'}>
                              {data.precipitation.change_from_baseline > 0 ? '+' : ''}{data.precipitation.change_from_baseline?.toFixed(1)}%
                            </span>
                          </td>
                          <td className="text-center p-2">
                            <Badge className={getHabitabilityColor(data.habitability.score)}>
                              {data.habitability.score?.toFixed(1)} - {getHabitabilityLevel(data.habitability.score)}
                            </Badge>
                          </td>
                          <td className="text-center p-2">
                            <span className={data.extremes.heat_stress_days > 30 ? 'text-red-600' : 'text-gray-900'}>
                              {data.extremes.heat_stress_days} days
                            </span>
                          </td>
                          <td className="text-center p-2 text-xs">
                            {data.atmospheric_physics.climate_zone}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Graphical Comparative Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Graphical Comparative Analysis - {targetYear}
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Visual comparison of key climate figures highlighting differences between locations
                </p>
              </CardHeader>
              <CardContent>
                <ComparisonCharts data={comparisonData} targetYear={targetYear} />
              </CardContent>
            </Card>
          </>
        )}

      </div>

      <footer className="mt-8 py-6 text-center text-xs text-slate-600" style={{ borderTop: "1px solid hsl(217,33%,15%)" }}>
        <p>© {new Date().getFullYear()} <a href="https://github.com/MikkoParkkola" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 underline underline-offset-2 transition-colors">Mikko Parkkola</a> · ClimateVision</p>
        <p className="mt-1">Powered by CBottle/ICON Atmospheric Physics · For research and planning purposes only</p>
      </footer>
    </div>
  );
}