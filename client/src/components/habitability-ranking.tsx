import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, MapPin, TrendingDown, AlertTriangle, Globe } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface HabitabilityRankingProps {
  selectedYear: number;
  onLocationSelect?: (latitude: number, longitude: number) => void;
}

interface GlobalRankedLocation {
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  baseline_habitability: number;
  future_habitability: number;
  habitability_change: number;
  temperature_change: number;
  precipitation_change: number;
}

interface GlobalRankings {
  best_habitability: GlobalRankedLocation[];
  worst_habitability: GlobalRankedLocation[];
  biggest_decline: GlobalRankedLocation[];
  year: number;
}

export default function HabitabilityRanking({ selectedYear, onLocationSelect }: HabitabilityRankingProps) {
  const { data: globalRankings, isLoading, error } = useQuery<GlobalRankings>({
    queryKey: ['/api/climate/global-rankings', selectedYear],
    queryFn: async () => {
      const response = await fetch(`/api/climate/global-rankings?year=${selectedYear}`);
      if (!response.ok) {
        throw new Error('Failed to fetch global rankings');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleLocationClick = (location: GlobalRankedLocation) => {
    if (onLocationSelect) {
      onLocationSelect(location.latitude, location.longitude);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    if (score >= 40) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-green-600 dark:text-green-400";
    if (change < -5) return "text-red-600 dark:text-red-400";
    return "text-yellow-600 dark:text-yellow-400";
  };

  const formatChange = (change: number) => {
    const sign = change > 0 ? "+" : "";
    return `${sign}${change.toFixed(1)}`;
  };

  const RankingCard = ({ 
    locations, 
    title, 
    icon: Icon, 
    description 
  }: { 
    locations: GlobalRankedLocation[], 
    title: string, 
    icon: any, 
    description: string 
  }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {locations.map((location, index) => (
            <div 
              key={`${location.name}-${index}`}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted cursor-pointer transition-colors"
              onClick={() => handleLocationClick(location)}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                  <span className="text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                </div>
                <div>
                  <div className="font-medium">{location.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {location.region}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-semibold ${getScoreColor(location.future_habitability)}`}>
                  {location.future_habitability.toFixed(0)}
                </div>
                <div className={`text-sm ${getChangeColor(location.habitability_change)}`}>
                  {formatChange(location.habitability_change)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Global Habitability Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <div className="space-y-2">
                  {[...Array(5)].map((_, j) => (
                    <Skeleton key={j} className="h-12 w-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !globalRankings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Global Habitability Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">
              Failed to load global rankings. Please try again later.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Global Habitability Rankings {selectedYear}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Worldwide climate habitability projections across major cities
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Best Habitability Table */}
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle className="text-green-700 flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Most Habitable Regions
              </CardTitle>
              <p className="text-sm text-green-600">
                Regions with highest projected habitability scores
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-green-200">
                      <th className="text-left py-2 font-medium text-green-800">Rank</th>
                      <th className="text-left py-2 font-medium text-green-800">Region/Area</th>
                      <th className="text-right py-2 font-medium text-green-800">Score</th>
                      <th className="text-right py-2 font-medium text-green-800">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {globalRankings.best_habitability.map((location, index) => (
                      <tr 
                        key={index}
                        className="border-b border-green-100 hover:bg-green-50 cursor-pointer transition-colors"
                        onClick={() => handleLocationClick(location)}
                      >
                        <td className="py-2">
                          <div className="flex items-center justify-center w-6 h-6 bg-green-600 text-white rounded-full text-xs font-bold">
                            {index + 1}
                          </div>
                        </td>
                        <td className="py-2">
                          <div>
                            <div className="font-medium text-gray-900">{location.name}</div>
                            <div className="text-xs text-green-600">{location.region}</div>
                          </div>
                        </td>
                        <td className="py-2 text-right">
                          <div className="font-bold text-green-600">
                            {location.future_habitability.toFixed(1)}
                          </div>
                        </td>
                        <td className="py-2 text-right">
                          <div className={`text-xs font-medium ${location.habitability_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {location.habitability_change >= 0 ? '+' : ''}{location.habitability_change.toFixed(1)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Most Challenging Table */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Most Challenging Regions
              </CardTitle>
              <p className="text-sm text-red-600">
                Regions facing greatest habitability challenges
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-red-200">
                      <th className="text-left py-2 font-medium text-red-800">Rank</th>
                      <th className="text-left py-2 font-medium text-red-800">Region/Area</th>
                      <th className="text-right py-2 font-medium text-red-800">Score</th>
                      <th className="text-right py-2 font-medium text-red-800">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {globalRankings.worst_habitability.map((location, index) => (
                      <tr 
                        key={index}
                        className="border-b border-red-100 hover:bg-red-50 cursor-pointer transition-colors"
                        onClick={() => handleLocationClick(location)}
                      >
                        <td className="py-2">
                          <div className="flex items-center justify-center w-6 h-6 bg-red-600 text-white rounded-full text-xs font-bold">
                            {index + 1}
                          </div>
                        </td>
                        <td className="py-2">
                          <div>
                            <div className="font-medium text-gray-900">{location.name}</div>
                            <div className="text-xs text-red-600">{location.region}</div>
                          </div>
                        </td>
                        <td className="py-2 text-right">
                          <div className="font-bold text-red-600">
                            {location.future_habitability.toFixed(1)}
                          </div>
                        </td>
                        <td className="py-2 text-right">
                          <div className={`text-xs font-medium ${location.habitability_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {location.habitability_change >= 0 ? '+' : ''}{location.habitability_change.toFixed(1)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Biggest Decline Table */}
          <Card className="border-orange-200">
            <CardHeader>
              <CardTitle className="text-orange-700 flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                Biggest Decline
              </CardTitle>
              <p className="text-sm text-orange-600">
                Regions with largest habitability drops
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-orange-200">
                      <th className="text-left py-2 font-medium text-orange-800">Rank</th>
                      <th className="text-left py-2 font-medium text-orange-800">Region/Area</th>
                      <th className="text-right py-2 font-medium text-orange-800">Decline</th>
                      <th className="text-right py-2 font-medium text-orange-800">Current</th>
                    </tr>
                  </thead>
                  <tbody>
                    {globalRankings.biggest_decline.map((location, index) => (
                      <tr 
                        key={index}
                        className="border-b border-orange-100 hover:bg-orange-50 cursor-pointer transition-colors"
                        onClick={() => handleLocationClick(location)}
                      >
                        <td className="py-2">
                          <div className="flex items-center justify-center w-6 h-6 bg-orange-600 text-white rounded-full text-xs font-bold">
                            {index + 1}
                          </div>
                        </td>
                        <td className="py-2">
                          <div>
                            <div className="font-medium text-gray-900">{location.name}</div>
                            <div className="text-xs text-orange-600">{location.region}</div>
                          </div>
                        </td>
                        <td className="py-2 text-right">
                          <div className="font-bold text-orange-600">
                            {Math.abs(location.habitability_change).toFixed(1)}
                          </div>
                        </td>
                        <td className="py-2 text-right">
                          <div className="text-xs text-gray-600">
                            {location.future_habitability.toFixed(1)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <div className="text-sm text-muted-foreground">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4" />
              Click any region to view its detailed climate projection
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-medium">Score:</span> Projected habitability (0-100)
              </div>
              <div>
                <span className="font-medium">Change:</span> Difference from current baseline
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}