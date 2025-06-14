import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { climateApi, geocodingUtils } from "@/lib/climate-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Globe, Download, Share2, Settings, MapPin, Calendar, BarChart3, TrendingUp, AlertTriangle, Search } from "lucide-react";
import InteractiveMap from "@/components/interactive-map";
import ClimateSummary from "@/components/climate-summary";
import ClimateCharts from "@/components/climate-charts";
import HabitabilityAssessment from "@/components/habitability-assessment";
import ComparableLocation from "@/components/comparable-location";
import ApiErrorDisplay from "@/components/api-error-display";
import ClimateTimeline from "@/components/climate-timeline";
import ClimateImpactExplanation from "@/components/climate-impact-explanation";
import HabitabilityRanking from "@/components/habitability-ranking";
import LivabilityIndexBreakdown from "@/components/livability-index-breakdown";
import QuickYearSelector from "@/components/quick-year-selector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { ClimateLocation, ClimateProjection, MapMarker } from "@/types/climate";

export default function ComprehensiveClimateReport() {
  const [selectedLocation, setSelectedLocation] = useState<ClimateLocation | undefined>();
  const [selectedYear, setSelectedYear] = useState<number>(2030);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingProjection, setIsLoadingProjection] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const { toast } = useToast();

  // Query for climate projection data
  const { data: projectionData, isLoading: isProjectionLoading, error: projectionError } = useQuery<ClimateProjection>({
    queryKey: ['/api/projections', selectedLocation?.id, selectedYear],
    queryFn: async () => {
      const response = await fetch(`/api/projections?locationId=${selectedLocation?.id}&year=${selectedYear}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch projection data: ${response.statusText}`);
      }
      const data = await response.json();
      console.log("Projection data received:", data);
      return data;
    },
    enabled: !!selectedLocation,
    retry: 2,
  });

  // Query for current climate data (2024)
  const { data: currentData, error: currentError } = useQuery<ClimateProjection>({
    queryKey: ['/api/projections', selectedLocation?.id, 2024],
    queryFn: async () => {
      const response = await fetch(`/api/projections?locationId=${selectedLocation?.id}&year=2024`);
      if (!response.ok) {
        throw new Error(`Failed to fetch current data: ${response.statusText}`);
      }
      const data = await response.json();
      console.log("Current data received:", data);
      return data;
    },
    enabled: !!selectedLocation,
    retry: 2,
  });

  // Location search functionality
  const searchLocationByText = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Use Nominatim geocoding API for location search
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`
      );
      
      if (response.ok) {
        const results = await response.json();
        const formattedResults = results.map((result: any) => ({
          name: result.display_name,
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          country: result.address?.country || '',
          region: result.address?.state || result.address?.province || ''
        }));
        setSearchResults(formattedResults);
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.length > 2) {
        searchLocationByText(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchLocationByText]);

  const createLocationMutation = useMutation({
    mutationFn: async (locationData: { name: string; latitude: number; longitude: number; country?: string; region?: string }) => {
      return await climateApi.createLocation(locationData);
    },
    onSuccess: (newLocation) => {
      setSelectedLocation(newLocation);
      queryClient.invalidateQueries({ queryKey: ['/api/projections'] });
    },
    onError: (error: Error) => {
      setApiError(error.message);
      toast({
        title: "Location Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLocationSelect = useCallback(async (latitude: number, longitude: number) => {
    try {
      setIsLoadingProjection(true);
      setApiError(null);

      const locationName = await geocodingUtils.reverseGeocode(latitude, longitude);
      
      const locationData = {
        name: locationName,
        latitude,
        longitude,
        country: locationName.split(', ').pop(),
        region: locationName.split(', ').slice(-2, -1)[0]
      };

      createLocationMutation.mutate(locationData);
    } catch (error) {
      console.error("Error selecting location:", error);
      setApiError(error instanceof Error ? error.message : "Failed to select location");
    } finally {
      setIsLoadingProjection(false);
    }
  }, [createLocationMutation]);

  const handleExportData = useCallback(async () => {
    if (!selectedLocation) return;

    try {
      const blob = await climateApi.exportCSV(selectedLocation.id, selectedYear);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `climate-projection-${selectedLocation.name}-${selectedYear}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Successful",
        description: "Climate data exported to CSV",
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "Unable to export data. Please try again.",
        variant: "destructive",
      });
    }
  }, [selectedLocation, selectedYear, toast]);

  const handlePrintReport = useCallback(() => {
    window.print();
  }, []);

  const handleShare = useCallback(() => {
    if (!selectedLocation) return;

    const shareUrl = `${window.location.origin}?location=${encodeURIComponent(selectedLocation.name)}&lat=${selectedLocation.latitude}&lng=${selectedLocation.longitude}&year=${selectedYear}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Climate Projection Report',
        text: `Comprehensive climate analysis for ${selectedLocation.name} in ${selectedYear}`,
        url: shareUrl,
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link Copied",
        description: "Share link copied to clipboard",
      });
    }
  }, [selectedLocation, selectedYear, toast]);

  const mapMarker: MapMarker | undefined = selectedLocation ? {
    latitude: selectedLocation.latitude,
    longitude: selectedLocation.longitude,
    name: selectedLocation.name,
  } : undefined;

  return (
    <div className="min-h-screen bg-white print:bg-white">
      {/* Header - Hidden in print */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Globe className="text-2xl text-blue-600 h-8 w-8" />
              <h1 className="text-xl font-semibold text-slate-900">Climate Projections Report</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintReport}
                className="flex items-center space-x-1"
              >
                <Download className="h-4 w-4" />
                <span>Print/PDF</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => alert('API key management coming soon')}
                className="flex items-center space-x-1"
              >
                <Settings className="h-4 w-4" />
                <span>API Keys</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:px-0 print:py-4">
        {/* Print Header */}
        <div className="hidden print:block mb-8">
          <div className="text-center border-b border-slate-200 pb-6">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Climate Projection Report</h1>
            {selectedLocation && (
              <div className="text-lg text-slate-600">
                <p>{selectedLocation.name}</p>
                <p className="text-sm">Generated on {new Date().toLocaleDateString()} | Projection Year: {selectedYear}</p>
              </div>
            )}
          </div>
        </div>

        {/* Year Selection - Hidden in print */}
        <div className="mb-8 print:hidden">
          <QuickYearSelector
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
          />
        </div>

        {/* Location Selection Section - Hidden in print */}
        <Card className="mb-8 print:hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location Selection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="location-search" className="text-sm font-medium">
                    Search Location
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="location-search"
                      type="text"
                      placeholder="Enter city name (e.g., Helsinki, New York)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-3">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                      </div>
                    )}
                  </div>
                  
                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="mt-2 max-h-60 overflow-y-auto border rounded-lg bg-white shadow-lg">
                      {searchResults.map((location, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            handleLocationSelect(location.latitude, location.longitude);
                            setSearchQuery("");
                            setSearchResults([]);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {location.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedLocation && (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h3 className="font-medium text-slate-900">{selectedLocation.name}</h3>
                    <p className="text-sm text-slate-600">
                      {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
                    </p>
                    <div className="flex space-x-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportData}
                        disabled={!projectionData}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Export CSV
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleShare}
                      >
                        <Share2 className="h-4 w-4 mr-1" />
                        Share
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <InteractiveMap
                  selectedLocation={mapMarker}
                  onLocationSelect={handleLocationSelect}
                  className="h-80 rounded-lg overflow-hidden"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {apiError && (
          <div className="mb-8 print:hidden">
            <ApiErrorDisplay 
              error={apiError} 
              onRetry={() => setApiError(null)}
            />
          </div>
        )}

        {selectedLocation && projectionData && currentData ? (
          <div className="space-y-8">
            {/* Key Metrics Overview with Ranges */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Key Climate Metrics Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Temperature */}
                  <div className="text-center p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-700">
                      {projectionData.averageTemperature?.toFixed(1)}°C
                    </div>
                    <div className="text-sm text-red-600 font-medium">Average Temperature</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Change: {projectionData.temperatureChange > 0 ? '+' : ''}{projectionData.temperatureChange?.toFixed(1)}°C
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Range: -40°C to +50°C
                      <br />
                      <span className="text-green-600">Optimal: 15-25°C</span>
                    </div>
                  </div>

                  {/* Precipitation */}
                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">
                      {Math.round(projectionData.annualPrecipitation || 0)}mm
                    </div>
                    <div className="text-sm text-blue-600 font-medium">Annual Precipitation</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Change: {projectionData.precipitationChange > 0 ? '+' : ''}{(projectionData.precipitationChange * 100)?.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Range: 0mm to 12,000mm
                      <br />
                      <span className="text-green-600">Optimal: 500-1500mm</span>
                    </div>
                  </div>

                  {/* Habitability Score */}
                  <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">
                      {Math.round(projectionData.habitabilityScore || 0)}%
                    </div>
                    <div className="text-sm text-green-600 font-medium">Habitability Score</div>
                    <div className="text-xs text-gray-600 mt-1">
                      vs Current: {Math.round((currentData.habitabilityScore || 0) - (projectionData.habitabilityScore || 0))}pts
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Range: 0-100%
                      <br />
                      <span className="text-green-600">Excellent: {'>'}80%</span>
                    </div>
                  </div>

                  {/* Sea Level Change */}
                  <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-700">
                      +{projectionData.seaLevelChange?.toFixed(2)}m
                    </div>
                    <div className="text-sm text-purple-600 font-medium">Sea Level Rise</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Risk: {Math.round(projectionData.coastalFloodingRisk || 0)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Range: 0m to +2m
                      <br />
                      <span className="text-red-600">Critical: &gt;0.5m</span>
                    </div>
                  </div>
                </div>

                {/* Risk Assessment Bar */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-3">Risk Assessment Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-700">Heat Stress</div>
                      <Progress value={projectionData.heatStressRisk || 0} className="mt-1" />
                      <div className="text-xs text-gray-500 mt-1">{Math.round(projectionData.heatStressRisk || 0)}% (0-100% range)</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700">Drought Risk</div>
                      <Progress value={projectionData.droughtRisk || 0} className="mt-1" />
                      <div className="text-xs text-gray-500 mt-1">{Math.round(projectionData.droughtRisk || 0)}% (0-100% range)</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700">Flooding Risk</div>
                      <Progress value={projectionData.floodingRisk || 0} className="mt-1" />
                      <div className="text-xs text-gray-500 mt-1">{Math.round(projectionData.floodingRisk || 0)}% (0-100% range)</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700">Water Stress</div>
                      <Progress value={projectionData.waterStressLevel || 0} className="mt-1" />
                      <div className="text-xs text-gray-500 mt-1">{Math.round(projectionData.waterStressLevel || 0)}% (0-100% range)</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Climate Data Visualization */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Climate Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <ClimateSummary
                    currentData={currentData}
                    projectedData={projectionData}
                    selectedYear={selectedYear}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Temperature & Precipitation Charts</CardTitle>
                </CardHeader>
                <CardContent>
                  <ClimateCharts
                    currentData={currentData}
                    projectedData={projectionData}
                    selectedYear={selectedYear}
                    onExport={handleExportData}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Habitability Assessment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Habitability Assessment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <HabitabilityAssessment
                  currentData={currentData}
                  projectedData={projectionData}
                  selectedYear={selectedYear}
                />
              </CardContent>
            </Card>

            {/* Detailed Livability Index */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Livability Index Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LivabilityIndexBreakdown
                  currentData={currentData}
                  projectedData={projectionData}
                  selectedYear={selectedYear}
                />
              </CardContent>
            </Card>

            {/* Climate Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Climate Timeline Analysis (2025-2100)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ClimateTimeline
                  selectedLocation={selectedLocation}
                  onYearSelect={setSelectedYear}
                />
              </CardContent>
            </Card>

            {/* Impact Explanation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Climate Impact Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ClimateImpactExplanation
                  currentData={currentData}
                  projectedData={projectionData}
                  selectedLocation={selectedLocation}
                  selectedYear={selectedYear}
                />
              </CardContent>
            </Card>

            {/* Comparable Location */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Climate Analogue (Similar Climate Location)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ComparableLocation
                  projectedData={projectionData}
                  selectedYear={selectedYear}
                  onViewLocation={handleLocationSelect}
                />
              </CardContent>
            </Card>

            {/* Global Habitability Rankings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Global Habitability Rankings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <HabitabilityRanking
                  selectedYear={selectedYear}
                  onLocationSelect={handleLocationSelect}
                />
              </CardContent>
            </Card>

            {/* Monthly Climate Data Table */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Climate Data Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Month
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Temperature (°C)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Precipitation (mm)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Range Info
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {projectionData.monthlyTemperatures && JSON.parse(projectionData.monthlyTemperatures).map((temp: number, index: number) => {
                        const precipitation = projectionData.monthlyPrecipitation ? JSON.parse(projectionData.monthlyPrecipitation)[index] : 0;
                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        return (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {months[index]}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {temp.toFixed(1)}°C
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {precipitation}mm
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                              {temp >= 15 && temp <= 25 ? 
                                <Badge variant="secondary" className="bg-green-100 text-green-700">Optimal Temp</Badge> : 
                                temp > 35 ? 
                                <Badge variant="destructive">Hot</Badge> : 
                                temp < 0 ? 
                                <Badge variant="outline" className="border-blue-500 text-blue-700">Cold</Badge> : 
                                <Badge variant="outline">Moderate</Badge>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Print Footer */}
            <div className="hidden print:block mt-12 pt-6 border-t border-slate-200">
              <div className="text-center text-sm text-slate-500">
                <p>This report was generated using NVIDIA Earth-2 Studio and CBottle climate models</p>
                <p>Data includes Arctic amplification effects and advanced climate projections</p>
                <p>Report generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
                <p>All values show actual ranges with optimal indicators for comprehensive analysis</p>
              </div>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Globe className="h-16 w-16 text-slate-400 mx-auto mb-6" />
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">
                Select a Location to Generate Report
              </h2>
              <p className="text-slate-600 mb-6">
                Choose a location on the map or search for a city to view comprehensive climate projections and generate a detailed report suitable for PDF export.
              </p>
              {isProjectionLoading && (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-slate-600">Loading climate data...</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>


    </div>
  );
}