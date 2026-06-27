import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Plus, X, Save, Download, BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { Line, Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from "chart.js";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ClimateLocation, ClimateProjection } from "@/types/climate";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

interface MultiLocationComparisonProps {
  initialLocations?: ClimateLocation[];
  selectedYear: number;
  onYearChange: (year: number) => void;
  className?: string;
}

interface ComparisonData {
  location: ClimateLocation;
  projection: ClimateProjection;
  currentProjection: ClimateProjection;
}

interface SavedComparison {
  id: number;
  name: string;
  locationIds: string;
  year: number;
}

interface ExportComparisonResponse {
  downloadUrl: string;
}

export default function MultiLocationComparison({ 
  initialLocations = [], 
  selectedYear, 
  onYearChange,
  className = "" 
}: MultiLocationComparisonProps) {
  const [selectedLocations, setSelectedLocations] = useState<ClimateLocation[]>(initialLocations);
  const [searchQuery, setSearchQuery] = useState("");
  const [comparisonName, setComparisonName] = useState("");
  const [activeTab, setActiveTab] = useState("temperature");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: searchResults = [] } = useQuery<ClimateLocation[]>({
    queryKey: ['/api/climate/search', searchQuery],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/locations/search?q=${encodeURIComponent(searchQuery)}`);
      return response.json();
    },
    enabled: searchQuery.length > 2,
  });

  const { data: comparisonData = [], isLoading } = useQuery<ComparisonData[]>({
    queryKey: ['/api/climate/multi-comparison', selectedLocations.map(l => l.id), selectedYear],
    queryFn: async () => {
      const locationIds = selectedLocations.map(l => l.id).join(",");
      const response = await apiRequest("GET", `/api/climate/multi-comparison?locationIds=${encodeURIComponent(locationIds)}&year=${selectedYear}`);
      return response.json();
    },
    enabled: selectedLocations.length > 0,
  });

  const { data: savedComparisons = [] } = useQuery<SavedComparison[]>({
    queryKey: ['/api/user/comparisons'],
  });

  const saveComparisonMutation = useMutation({
    mutationFn: async (data: { name: string; locationIds: number[]; year: number }) => {
      return await apiRequest("POST", "/api/user/comparisons", data);
    },
    onSuccess: () => {
      toast({
        title: "Comparison Saved",
        description: "Your multi-location comparison has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user/comparisons'] });
      setComparisonName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const exportPdfMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/climate/export-comparison", {
        locationIds: selectedLocations.map(l => l.id),
        year: selectedYear,
        name: comparisonName || `Climate Comparison ${selectedYear}`,
      });
      return response.json() as Promise<ExportComparisonResponse>;
    },
    onSuccess: (data) => {
      // Create and download PDF
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = `climate-comparison-${selectedYear}.pdf`;
      link.click();
      
      toast({
        title: "PDF Generated",
        description: "Your comparison report has been downloaded.",
      });
    },
  });

  const addLocation = (location: ClimateLocation) => {
    if (selectedLocations.length >= 5) {
      toast({
        title: "Maximum Locations",
        description: "You can compare up to 5 locations at once.",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedLocations.find(l => l.id === location.id)) {
      setSelectedLocations([...selectedLocations, location]);
      setSearchQuery("");
    }
  };

  const removeLocation = (locationId: number) => {
    setSelectedLocations(selectedLocations.filter(l => l.id !== locationId));
  };

  const handleSaveComparison = () => {
    if (!comparisonName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your comparison.",
        variant: "destructive",
      });
      return;
    }

    if (selectedLocations.length < 2) {
      toast({
        title: "More Locations Needed",
        description: "Please select at least 2 locations to compare.",
        variant: "destructive",
      });
      return;
    }

    saveComparisonMutation.mutate({
      name: comparisonName,
      locationIds: selectedLocations.map(l => l.id),
      year: selectedYear,
    });
  };

  const generateChartData = (metric: string) => {
    if (!comparisonData) return null;

    const labels = comparisonData.map((item: ComparisonData) => item.location.name);
    const currentData = comparisonData.map((item: ComparisonData) => {
      switch (metric) {
        case 'temperature':
          return item.currentProjection?.averageTemperature || 0;
        case 'precipitation':
          return item.currentProjection?.annualPrecipitation || 0;
        case 'habitability':
          return item.currentProjection?.habitabilityScore || 0;
        case 'seaLevel':
          return item.currentProjection?.seaLevel || 0;
        default:
          return 0;
      }
    });

    const projectedData = comparisonData.map((item: ComparisonData) => {
      switch (metric) {
        case 'temperature':
          return item.projection?.averageTemperature || 0;
        case 'precipitation':
          return item.projection?.annualPrecipitation || 0;
        case 'habitability':
          return item.projection?.habitabilityScore || 0;
        case 'seaLevel':
          return item.projection?.seaLevel || 0;
        default:
          return 0;
      }
    });

    return {
      labels,
      datasets: [
        {
          label: 'Current (2024)',
          data: currentData,
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 2,
        },
        {
          label: `Projected (${selectedYear})`,
          data: projectedData,
          backgroundColor: 'rgba(239, 68, 68, 0.5)',
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 2,
        },
      ],
    };
  };

  const getMetricUnit = (metric: string) => {
    switch (metric) {
      case 'temperature':
        return '°C';
      case 'precipitation':
        return 'mm';
      case 'habitability':
        return '/100';
      case 'seaLevel':
        return 'm';
      default:
        return '';
    }
  };

  const getMetricTitle = (metric: string) => {
    switch (metric) {
      case 'temperature':
        return 'Average Temperature';
      case 'precipitation':
        return 'Annual Precipitation';
      case 'habitability':
        return 'Habitability Score';
      case 'seaLevel':
        return 'Sea Level Change';
      default:
        return metric;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Multi-Location Climate Comparison
          </CardTitle>
          <CardDescription>
            Compare climate projections across up to 5 locations for comprehensive analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {selectedLocations.map(location => (
              <Badge key={location.id} variant="secondary" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {location.name}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => removeLocation(location.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Search for locations to add..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchResults && searchQuery.length > 2 && (
                <div className="mt-2 border rounded-md bg-white dark:bg-gray-800 shadow-lg max-h-40 overflow-y-auto">
                  {searchResults.map((location: ClimateLocation) => (
                    <button
                      key={location.id}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                      onClick={() => addLocation(location)}
                    >
                      <MapPin className="h-4 w-4" />
                      <span>{location.name}</span>
                      {location.country && <span className="text-sm text-muted-foreground">({location.country})</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Select value={selectedYear.toString()} onValueChange={(value) => onYearChange(parseInt(value))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100].map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Enter comparison name to save..."
              value={comparisonName}
              onChange={(e) => setComparisonName(e.target.value)}
            />
            <Button
              onClick={handleSaveComparison}
              disabled={saveComparisonMutation.isPending || selectedLocations.length < 2}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save
            </Button>
            <Button
              variant="outline"
              onClick={() => exportPdfMutation.mutate()}
              disabled={exportPdfMutation.isPending || selectedLocations.length < 2}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedLocations.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Comparison Charts</CardTitle>
            <CardDescription>
              Visual comparison of climate metrics across selected locations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="temperature">Temperature</TabsTrigger>
                <TabsTrigger value="precipitation">Precipitation</TabsTrigger>
                <TabsTrigger value="habitability">Habitability</TabsTrigger>
                <TabsTrigger value="seaLevel">Sea Level</TabsTrigger>
              </TabsList>

              {['temperature', 'precipitation', 'habitability', 'seaLevel'].map(metric => (
                <TabsContent key={metric} value={metric} className="space-y-4">
                  <div className="h-64">
                    {isLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    ) : (
                      <Bar
                        data={generateChartData(metric) || { labels: [], datasets: [] }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            title: {
                              display: true,
                              text: `${getMetricTitle(metric)} Comparison (${getMetricUnit(metric)})`,
                            },
                            legend: {
                              position: 'top',
                            },
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                            },
                          },
                        }}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {comparisonData?.map((item: ComparisonData, index: number) => {
                      const currentValue = (() => {
                        switch (metric) {
                          case 'temperature':
                            return item.currentProjection?.averageTemperature || 0;
                          case 'precipitation':
                            return item.currentProjection?.annualPrecipitation || 0;
                          case 'habitability':
                            return item.currentProjection?.habitabilityScore || 0;
                          case 'seaLevel':
                            return item.currentProjection?.seaLevel || 0;
                          default:
                            return 0;
                        }
                      })();

                      const projectedValue = (() => {
                        switch (metric) {
                          case 'temperature':
                            return item.projection?.averageTemperature || 0;
                          case 'precipitation':
                            return item.projection?.annualPrecipitation || 0;
                          case 'habitability':
                            return item.projection?.habitabilityScore || 0;
                          case 'seaLevel':
                            return item.projection?.seaLevel || 0;
                          default:
                            return 0;
                        }
                      })();

                      const change = projectedValue - currentValue;
                      const isIncrease = change > 0;

                      return (
                        <Card key={index} className="p-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{item.location.name}</h4>
                            <div className="flex items-center gap-1">
                              {isIncrease ? (
                                <TrendingUp className="h-4 w-4 text-red-500" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-green-500" />
                              )}
                              <span className={`text-sm ${isIncrease ? 'text-red-500' : 'text-green-500'}`}>
                                {isIncrease ? '+' : ''}{change.toFixed(1)}{getMetricUnit(metric)}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground">
                            <div>Current: {currentValue.toFixed(1)}{getMetricUnit(metric)}</div>
                            <div>Projected: {projectedValue.toFixed(1)}{getMetricUnit(metric)}</div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {savedComparisons && savedComparisons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saved Comparisons</CardTitle>
            <CardDescription>
              Your previously saved multi-location comparisons
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {savedComparisons.map((comparison) => (
                <div key={comparison.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{comparison.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {JSON.parse(comparison.locationIds).length} locations • Year {comparison.year}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Load this comparison
                      const locationIds = JSON.parse(comparison.locationIds) as number[];
                      // You would need to fetch these locations and set them
                      void locationIds;
                      onYearChange(comparison.year);
                    }}
                  >
                    Load
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
