import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { climateApi, geocodingUtils } from "@/lib/climate-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Globe, Download, FileText, Share2, X, Settings, BarChart3, Waves, Calendar } from "lucide-react";
import InteractiveMap from "@/components/interactive-map";
import LocationSelector from "@/components/location-selector";
import ClimateSummary from "@/components/climate-summary";
import ClimateCharts from "@/components/climate-charts";
import HabitabilityAssessment from "@/components/habitability-assessment";
import ComparableLocation from "@/components/comparable-location";
import ApiErrorDisplay from "@/components/api-error-display";
import ClimateTimeline from "@/components/climate-timeline";
import ClimateImpactExplanation from "@/components/climate-impact-explanation";
import HabitabilityRanking from "@/components/habitability-ranking-refactored";
import ApiKeyManager from "@/components/api-key-manager";
import MultiLocationComparison from "@/components/multi-location-comparison";
import LivabilityIndexBreakdown from "@/components/livability-index-breakdown";
import QuickYearSelector from "@/components/quick-year-selector";
import type { ClimateLocation, ClimateProjection, MapMarker } from "@/types/climate";

export default function EnhancedClimateDashboard() {
  const [selectedLocation, setSelectedLocation] = useState<ClimateLocation | undefined>();
  const [selectedYear, setSelectedYear] = useState<number>(2030);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [isLoadingProjection, setIsLoadingProjection] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const { toast } = useToast();

  // Query for climate projection data
  const { data: projectionData, isLoading: isProjectionLoading, error: projectionError } = useQuery<ClimateProjection>({
    queryKey: ['/api/projections', selectedLocation?.id, selectedYear],
    queryFn: () => fetch(`/api/projections?locationId=${selectedLocation?.id}&year=${selectedYear}`).then(res => res.json()),
    enabled: !!selectedLocation,
    retry: 2,
  });

  // Query for current climate data (2024)
  const { data: currentData } = useQuery<ClimateProjection>({
    queryKey: ['/api/projections', selectedLocation?.id, 2024],
    queryFn: () => fetch(`/api/projections?locationId=${selectedLocation?.id}&year=2024`).then(res => res.json()),
    enabled: !!selectedLocation,
    retry: 2,
  });

  // Debug logging
  console.log("Climate Dashboard Debug:", {
    selectedLocation: selectedLocation?.id,
    selectedYear,
    projectionData,
    currentData,
    isProjectionLoading
  });

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

  const handleGetProjection = useCallback(async () => {
    if (!selectedLocation) return;

    try {
      setIsLoadingProjection(true);
      setApiError(null);
      
      // Invalidate queries to force refetch
      await queryClient.invalidateQueries({ 
        queryKey: ['/api/projections', selectedLocation.id, selectedYear] 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['/api/projections', selectedLocation.id, 2024] 
      });
    } catch (error) {
      console.error("Error getting projection:", error);
      setApiError(error instanceof Error ? error.message : "Failed to get projection");
    } finally {
      setIsLoadingProjection(false);
    }
  }, [selectedLocation, selectedYear]);

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

  const handleShare = useCallback(() => {
    if (!selectedLocation) return;

    const shareUrl = `${window.location.origin}?location=${encodeURIComponent(selectedLocation.name)}&lat=${selectedLocation.latitude}&lng=${selectedLocation.longitude}&year=${selectedYear}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Climate Projection',
        text: `Climate projection for ${selectedLocation.name} in ${selectedYear}`,
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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Globe className="text-2xl text-blue-600 h-8 w-8" />
              <h1 className="text-xl font-semibold text-slate-900">Climate Projections Explorer</h1>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="#" className="text-slate-600 hover:text-blue-600 transition-colors">Dashboard</a>
              <a href="#" className="text-slate-600 hover:text-blue-600 transition-colors">Compare</a>
              <a href="#" className="text-slate-600 hover:text-blue-600 transition-colors">Documentation</a>
              <Button className="bg-blue-600 text-white hover:bg-blue-700">
                Account
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <Tabs defaultValue="analysis" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="analysis" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Analysis
              </TabsTrigger>
              <TabsTrigger value="comparison" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Multi-Compare
              </TabsTrigger>
              <TabsTrigger value="sealevel" className="flex items-center gap-2">
                <Waves className="h-4 w-4" />
                Sea Level
              </TabsTrigger>
              <TabsTrigger value="livability" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Livability
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="analysis" className="space-y-8">
              {/* Quick Year Selector */}
              <QuickYearSelector
                selectedYear={selectedYear}
                onYearChange={setSelectedYear}
              />

              {/* Controls Section */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <LocationSelector
                    selectedLocation={selectedLocation}
                    selectedYear={selectedYear}
                    onLocationChange={setSelectedLocation}
                    onLocationSelect={handleLocationSelect}
                    onYearChange={setSelectedYear}
                    onGetProjection={handleGetProjection}
                    onCompareMode={() => setComparisonMode(!comparisonMode)}
                    isLoading={isLoadingProjection || isProjectionLoading}
                  />
                  
                  {selectedLocation && (
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <h3 className="font-medium text-slate-900">{selectedLocation.name}</h3>
                        <p className="text-sm text-slate-600">
                          {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportData}
                          disabled={!projectionData}
                          className="flex items-center space-x-1"
                        >
                          <Download className="h-4 w-4" />
                          <span>Export</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleShare}
                          className="flex items-center space-x-1"
                        >
                          <Share2 className="h-4 w-4" />
                          <span>Share</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {apiError && (
                <ApiErrorDisplay 
                  error={apiError} 
                  onRetry={() => {
                    setApiError(null);
                    if (selectedLocation) {
                      handleGetProjection();
                    }
                  }}
                />
              )}

              {/* Map and Data Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <InteractiveMap
                    selectedLocation={mapMarker}
                    onLocationSelect={handleLocationSelect}
                    className="h-96 rounded-lg overflow-hidden shadow-sm border border-slate-200"
                  />
                </div>

                <div className="space-y-6">
                  {selectedLocation && projectionData && currentData ? (
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
                        onExport={handleExportData}
                      />

                      <HabitabilityAssessment
                        currentData={currentData}
                        projectedData={projectionData}
                        selectedYear={selectedYear}
                      />

                      <ComparableLocation
                        projectedData={projectionData}
                        selectedYear={selectedYear}
                        onViewLocation={handleLocationSelect}
                      />
                    </>
                  ) : (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <Globe className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 mb-2">
                          Select a Location
                        </h3>
                        <p className="text-slate-600">
                          Choose a location on the map or search for a city to view climate projections
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              {/* Timeline Section */}
              {selectedLocation && (
                <div className="space-y-6">
                  <ClimateTimeline
                    selectedLocation={selectedLocation}
                    onYearSelect={setSelectedYear}
                  />
                  
                  <ClimateImpactExplanation
                    currentData={currentData}
                    projectedData={projectionData}
                    selectedLocation={selectedLocation}
                    selectedYear={selectedYear}
                  />
                </div>
              )}

              {/* Rankings Section */}
              <HabitabilityRanking
                selectedYear={selectedYear}
                onLocationSelect={handleLocationSelect}
              />
            </TabsContent>

            <TabsContent value="comparison" className="space-y-6">
              <MultiLocationComparison
                initialLocations={selectedLocation ? [selectedLocation] : []}
                selectedYear={selectedYear}
                onYearChange={setSelectedYear}
              />
            </TabsContent>

            <TabsContent value="sealevel" className="space-y-6">
              <QuickYearSelector
                selectedYear={selectedYear}
                onYearChange={setSelectedYear}
              />
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <LocationSelector
                  selectedLocation={selectedLocation}
                  selectedYear={selectedYear}
                  onLocationChange={setSelectedLocation}
                  onLocationSelect={handleLocationSelect}
                  onYearChange={setSelectedYear}
                  onGetProjection={handleGetProjection}
                  onCompareMode={() => setComparisonMode(!comparisonMode)}
                  isLoading={isLoadingProjection}
                />
                
                <Card>
                  <CardContent className="p-6">
                    <div className="h-96 bg-muted rounded-lg flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <Waves className="h-12 w-12 mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">Sea Level Visualization</h3>
                        <p className="text-sm">Interactive coastal flooding risk overlay</p>
                        <p className="text-sm mt-1">Satellite, terrain, and ocean views</p>
                        {projectionData?.seaLevelChange && (
                          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded">
                            <p className="text-sm font-medium">
                              Projected Sea Level Rise: +{projectionData.seaLevelChange.toFixed(2)}m by {selectedYear}
                            </p>
                            <p className="text-xs mt-1 text-blue-600">
                              Coastal Flooding Risk: {projectionData.coastalFloodingRisk}%
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="livability" className="space-y-6">
              <LivabilityIndexBreakdown
                currentData={currentData}
                projectedData={projectionData}
                selectedYear={selectedYear}
              />
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <ApiKeyManager />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
