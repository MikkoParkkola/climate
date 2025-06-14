import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { climateApi, geocodingUtils } from "@/lib/climate-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Globe, Download, FileText, Share2, X } from "lucide-react";
import InteractiveMap from "@/components/interactive-map";
import LocationSelector from "@/components/location-selector";
import ClimateSummary from "@/components/climate-summary";
import ClimateCharts from "@/components/climate-charts";
import HabitabilityAssessment from "@/components/habitability-assessment";
import ComparableLocation from "@/components/comparable-location";
import ApiErrorDisplay from "@/components/api-error-display";
import type { ClimateLocation, ClimateProjection, MapMarker } from "@/types/climate";

export default function ClimateDashboard() {
  const [selectedLocation, setSelectedLocation] = useState<ClimateLocation | undefined>();
  const [selectedYear, setSelectedYear] = useState<number>(2030);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [isLoadingProjection, setIsLoadingProjection] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const { toast } = useToast();

  // Query for climate projection data
  const { data: projectionData, isLoading: isProjectionLoading, error: projectionError } = useQuery<ClimateProjection>({
    queryKey: [`/api/projections/${selectedLocation?.id}/${selectedYear}`],
    enabled: selectedLocation?.id !== undefined,
  });

  // Query for current climate data (baseline year)
  const { data: currentData, error: currentError } = useQuery<ClimateProjection>({
    queryKey: [`/api/projections/${selectedLocation?.id}/2024`],
    enabled: selectedLocation?.id !== undefined,
  });

  // Debug logging
  console.log('Climate Dashboard Debug:', {
    selectedLocation: selectedLocation?.id,
    selectedYear,
    projectionData,
    currentData,
    isProjectionLoading,
    projectionError: projectionError?.message,
    currentError: currentError?.message
  });

  // Mutation for creating locations
  const createLocationMutation = useMutation({
    mutationFn: climateApi.createLocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
    },
  });

  const handleLocationSelect = useCallback(async (latitude: number, longitude: number) => {
    console.log('handleLocationSelect called with:', { latitude, longitude });
    try {
      const locationName = await geocodingUtils.reverseGeocode(latitude, longitude);
      console.log('Geocoded location name:', locationName);

      // Create location in backend and get the real ID
      const createdLocation = await createLocationMutation.mutateAsync({
        name: locationName,
        latitude,
        longitude,
      });

      console.log('Created location:', createdLocation);
      setSelectedLocation(createdLocation);
      
      toast({
        title: "Location Selected",
        description: `Selected ${locationName}`,
      });
    } catch (error) {
      console.error("Error selecting location:", error);
      toast({
        title: "Error",
        description: "Failed to select location. Please try again.",
        variant: "destructive",
      });
    }
  }, [createLocationMutation, toast]);

  const handleGetProjection = useCallback(async () => {
    if (!selectedLocation) {
      toast({
        title: "No Location Selected",
        description: "Please select a location first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingProjection(true);
    try {
      // Invalidate cache to force fresh data fetch
      await queryClient.invalidateQueries({ 
        queryKey: [`/api/projections/${selectedLocation.id}/${selectedYear}`] 
      });
      
      toast({
        title: "Climate Projection Updated",
        description: `Fetched latest projection data for ${selectedLocation.name}`,
      });
    } catch (error) {
      console.error("Error fetching projection:", error);
      toast({
        title: "Error",
        description: "Failed to fetch climate projection. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingProjection(false);
    }
  }, [selectedLocation, selectedYear, toast]);

  const handleExportCSV = useCallback(async () => {
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Location Selector */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Location Input Panel */}
              <div className="lg:w-1/3">
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
              </div>

              {/* Interactive Map */}
              <div className="lg:w-2/3">
                <InteractiveMap
                  selectedLocation={mapMarker}
                  onLocationSelect={handleLocationSelect}
                  className="h-[500px]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Climate Data Display */}
        {selectedLocation && (
          <>
            <div className="mb-8">
              <ClimateSummary
                currentData={currentData}
                projectedData={projectionData}
                selectedYear={selectedYear}
              />
            </div>

            {/* Data Visualization */}
            <div className="mb-8">
              <ClimateCharts
                currentData={currentData}
                projectedData={projectionData}
                selectedYear={selectedYear}
                onExport={(type) => {
                  toast({
                    title: "Export Feature",
                    description: `${type} chart export will be available soon`,
                  });
                }}
              />
            </div>

            {/* Habitability Assessment */}
            <div className="mb-8">
              <HabitabilityAssessment
                currentData={currentData}
                projectedData={projectionData}
                selectedYear={selectedYear}
              />
            </div>

            {/* Comparable Location Analysis */}
            <div className="mb-8">
              <ComparableLocation
                projectedData={projectionData}
                selectedYear={selectedYear}
                onViewLocation={(lat, lng) => {
                  // This would ideally pan the map to the comparable location
                  toast({
                    title: "Comparable Location",
                    description: `Climate analog location at ${lat.toFixed(2)}°, ${lng.toFixed(2)}°`,
                  });
                }}
              />
            </div>

            {/* Action Panel */}
            <Card className="mb-8">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">Export & Share Data</h3>
                    <p className="text-sm text-slate-600">Download projections or share your analysis</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={handleExportCSV}
                      className="bg-green-600 text-white hover:bg-green-700"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download CSV
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        toast({
                          title: "Feature Coming Soon",
                          description: "PDF export will be available soon",
                        });
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Export PDF
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleShare}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Share Link
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Comparison Panel */}
            {comparisonMode && (
              <Card className="mb-8">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                      <Share2 className="text-blue-600 mr-2 h-5 w-5" />
                      Location Comparison
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setComparisonMode(false)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-center text-slate-600 py-8">
                    <p>Comparison feature will be available soon.</p>
                    <p className="text-sm mt-2">Select a second location to compare climate projections side-by-side.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
