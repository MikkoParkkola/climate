import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { climateApi, geocodingUtils } from "@/lib/climate-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Globe, Download, Share2, Settings, MapPin, Calendar, BarChart3, TrendingUp, AlertTriangle, Search, Bug, FileText, Printer } from "lucide-react";
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
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [debugData, setDebugData] = useState<{ request: any; response: any } | null>(null);
  const [showFullReport, setShowFullReport] = useState(false);
  const { toast } = useToast();

  // Query for climate projection data
  const { data: projectionData, isLoading: isProjectionLoading, error: projectionError } = useQuery<ClimateProjection>({
    queryKey: ['/api/projections', selectedLocation?.id, selectedYear],
    queryFn: async () => {
      const requestData = { locationId: selectedLocation?.id, year: selectedYear };
      const response = await fetch(`/api/projections?locationId=${selectedLocation?.id}&year=${selectedYear}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch projection data: ${response.statusText}`);
      }
      const data = await response.json();
      console.log("API Request:", requestData);
      console.log("API Response:", data);
      
      // Store debug information
      setDebugData({
        request: requestData,
        response: data
      });
      
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

  // Search for locations by text
  const searchLocationByText = useCallback(async (query: string) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
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
      console.log("Creating location with data:", locationData);
      return await climateApi.createLocation(locationData);
    },
    onSuccess: (newLocation) => {
      console.log("Location created successfully:", newLocation);
      setSelectedLocation(newLocation);
      queryClient.invalidateQueries({ queryKey: ['/api/projections'] });
    },
    onError: (error: Error) => {
      console.error("Location creation failed:", error);
      setApiError(error.message);
      toast({
        title: "Location Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getProjectionMutation = useMutation({
    mutationFn: async ({ locationId, year }: { locationId: number; year: number }) => {
      return await climateApi.getClimateProjection(locationId, year);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projections'] });
    },
    onError: (error: Error) => {
      setApiError(error.message);
    },
  });

  const handleLocationSelect = useCallback(async (latitude: number, longitude: number) => {
    try {
      setIsLoadingProjection(true);
      setApiError(null);

      // Get location name from coordinates
      const locationName = await geocodingUtils.reverseGeocode(latitude, longitude);
      
      const locationData = {
        name: locationName,
        latitude,
        longitude,
      };

      await createLocationMutation.mutateAsync(locationData);
    } catch (error: any) {
      console.error("Location selection error:", error);
      setApiError(error.message || "Failed to select location");
      toast({
        title: "Location Selection Failed",
        description: error.message || "Unable to select this location. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingProjection(false);
    }
  }, [createLocationMutation, toast]);

  const handleExportCSV = useCallback(async () => {
    if (!selectedLocation || !projectionData) return;
    
    try {
      const response = await fetch(`/api/projections/${selectedLocation.id}/${selectedYear}/export`);
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `climate-projection-${selectedLocation.name}-${selectedYear}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Successful",
        description: "Climate data exported as CSV file.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Unable to export data. Please try again.",
        variant: "destructive",
      });
    }
  }, [selectedLocation, selectedYear, toast]);

  const handleGetProjection = useCallback(async () => {
    if (!selectedLocation) return;
    
    setIsLoadingProjection(true);
    setApiError(null);
    
    try {
      await getProjectionMutation.mutateAsync({
        locationId: selectedLocation.id,
        year: selectedYear
      });
    } catch (error) {
      console.error("Projection error:", error);
      setApiError(error instanceof Error ? error.message : "Failed to get projection");
    } finally {
      setIsLoadingProjection(false);
    }
  }, [selectedLocation, selectedYear]);

  const handlePrintReport = useCallback(() => {
    window.print();
  }, []);

  const handleShare = useCallback(() => {
    if (!selectedLocation) return;

    const shareUrl = `${window.location.origin}${window.location.pathname}?location=${encodeURIComponent(selectedLocation.name)}&year=${selectedYear}`;
    
    if (navigator.share) {
      navigator.share({
        title: `Climate Report for ${selectedLocation.name}`,
        text: `View climate projections for ${selectedLocation.name} in ${selectedYear}`,
        url: shareUrl,
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link Copied",
        description: "Report link copied to clipboard.",
      });
    }
  }, [selectedLocation, selectedYear, toast]);

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Globe className="h-8 w-8 text-blue-600" />
              <h1 className="text-xl font-semibold text-slate-900">Climate Projection Report</h1>
            </div>
            <div className="flex items-center space-x-4">
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

        {/* Year Selection and Controls */}
        <Card className="mb-8 print:hidden">
          <CardHeader>
            <CardTitle>Climate Projection Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-medium mb-4">Interactive Map & Location Search</h3>
                <div className="space-y-4">
                  <InteractiveMap
                    selectedLocation={selectedLocation ? {
                      latitude: selectedLocation.latitude,
                      longitude: selectedLocation.longitude,
                      name: selectedLocation.name
                    } : undefined}
                    onLocationSelect={handleLocationSelect}
                  />
                  
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
                </div>
                
                {selectedLocation && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                    <h3 className="font-medium text-slate-900">{selectedLocation.name}</h3>
                    <p className="text-sm text-slate-600">
                      {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
                    </p>
                    
                    {selectedLocation && (
                      <div className="flex gap-2 mt-4">
                        <Button
                          onClick={handleShare}
                          variant="outline"
                          size="sm"
                          className="flex items-center space-x-1"
                        >
                          <Share2 className="h-4 w-4" />
                          Share
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="mt-6 space-y-4">
                  <div>
                    <Label htmlFor="year-input" className="text-sm font-medium">
                      Select any year from 2025 to 2100
                    </Label>
                    <div className="flex gap-4 items-center mt-2">
                      <Input
                        id="year-input"
                        type="number"
                        min="2025"
                        max="2100"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="w-32"
                      />
                      <QuickYearSelector
                        selectedYear={selectedYear}
                        onYearChange={setSelectedYear}
                      />
                    </div>
                  </div>
                  
                  <Button
                    onClick={handleGetProjection}
                    disabled={!selectedLocation || isLoadingProjection}
                    className="w-full"
                  >
                    {isLoadingProjection ? 'Generating Projection...' : 'Get Climate Projection'}
                  </Button>
                  
                  {selectedLocation && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => setShowDebugInfo(!showDebugInfo)}
                        variant="outline"
                        size="sm"
                      >
                        <Bug className="h-4 w-4 mr-2" />
                        {showDebugInfo ? 'Hide' : 'Show'} Debug
                      </Button>
                      <Button
                        onClick={() => setShowFullReport(!showFullReport)}
                        variant="outline"
                        size="sm"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        {showFullReport ? 'Hide' : 'Show'} Full Report
                      </Button>
                    </div>
                  )}
                </div>
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

        {/* Debug Information Panel */}
        {showDebugInfo && debugData && (
          <Card className="p-6 bg-gray-50 mb-8">
            <h3 className="text-lg font-semibold mb-4">API Debug Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Request</h4>
                <pre className="bg-white p-3 rounded border text-xs overflow-auto">
                  {JSON.stringify(debugData.request, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="font-medium mb-2">Response</h4>
                <pre className="bg-white p-3 rounded border text-xs overflow-auto max-h-60">
                  {JSON.stringify(debugData.response, null, 2)}
                </pre>
              </div>
            </div>
          </Card>
        )}

        {selectedLocation && projectionData && currentData ? (
          <div className="space-y-8">
            {/* Always visible: Basic Climate Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Climate Summary for {selectedLocation.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {projectionData?.averageTemperature?.toFixed(1)}°C
                    </div>
                    <div className="text-sm text-gray-600">Temperature {selectedYear}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {projectionData?.annualPrecipitation?.toFixed(0)}mm
                    </div>
                    <div className="text-sm text-gray-600">Precipitation</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {projectionData?.habitabilityScore}/100
                    </div>
                    <div className="text-sm text-gray-600">Habitability</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {projectionData?.waterStressLevel}/100
                    </div>
                    <div className="text-sm text-gray-600">Water Stress</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Climate Timeline - Always Visible */}
            <ClimateTimeline 
              selectedLocation={selectedLocation}
              onYearSelect={setSelectedYear}
            />

            {showFullReport && (
              <>
                <ClimateSummary
                  currentData={currentData}
                  projectedData={projectionData}
                  selectedYear={selectedYear}
                />

                <ClimateCharts
                  currentData={currentData}
                  projectedData={projectionData}
                  selectedYear={selectedYear}
                />

                <HabitabilityAssessment
                  currentData={currentData}
                  projectedData={projectionData}
                  selectedYear={selectedYear}
                />

                <LivabilityIndexBreakdown
                  currentData={currentData}
                  projectedData={projectionData}
                  selectedYear={selectedYear}
                />

                <ClimateImpactExplanation
                  currentData={currentData}
                  projectedData={projectionData}
                  selectedLocation={selectedLocation}
                  selectedYear={selectedYear}
                />

                <ComparableLocation
                  projectedData={projectionData}
                  selectedYear={selectedYear}
                  onViewLocation={handleLocationSelect}
                />

                <HabitabilityRanking
                  selectedYear={selectedYear}
                  onLocationSelect={handleLocationSelect}
                />
              </>
            )}
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