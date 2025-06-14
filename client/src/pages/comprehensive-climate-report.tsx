import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { climateApi, geocodingUtils } from "@/lib/climate-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Globe, Download, Share2, Settings, MapPin, Calendar, BarChart3, TrendingUp, AlertTriangle } from "lucide-react";
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
import type { ClimateLocation, ClimateProjection, MapMarker } from "@/types/climate";

export default function ComprehensiveClimateReport() {
  const [selectedLocation, setSelectedLocation] = useState<ClimateLocation | undefined>();
  const [selectedYear, setSelectedYear] = useState<number>(2030);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingProjection, setIsLoadingProjection] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const { toast } = useToast();

  // Query for climate projection data
  const { data: projectionData, isLoading: isProjectionLoading } = useQuery<ClimateProjection>({
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
                <div>
                  <Label htmlFor="location-search" className="text-sm font-medium">
                    Search Location
                  </Label>
                  <Input
                    id="location-search"
                    type="text"
                    placeholder="Enter city name (e.g., Helsinki, New York)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mt-1"
                  />
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
            {/* Executive Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                </div>
              </CardContent>
            </Card>

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
                  Climate Timeline Analysis
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
                  Climate Analogue
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

            {/* Print Footer */}
            <div className="hidden print:block mt-12 pt-6 border-t border-slate-200">
              <div className="text-center text-sm text-slate-500">
                <p>This report was generated using NVIDIA Earth-2 Studio and CBottle climate models</p>
                <p>Data includes Arctic amplification effects and advanced climate projections</p>
                <p>Report generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
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