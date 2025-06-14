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
        <Tabs defaultValue="best" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="best">Most Habitable</TabsTrigger>
            <TabsTrigger value="worst">Least Habitable</TabsTrigger>
            <TabsTrigger value="decline">Biggest Decline</TabsTrigger>
          </TabsList>
          
          <TabsContent value="best" className="mt-6">
            <RankingCard
              locations={globalRankings.best_habitability}
              title="Most Habitable Cities"
              icon={Trophy}
              description="Cities with the highest projected habitability scores"
            />
          </TabsContent>
          
          <TabsContent value="worst" className="mt-6">
            <RankingCard
              locations={globalRankings.worst_habitability}
              title="Least Habitable Cities"
              icon={AlertTriangle}
              description="Cities facing the greatest habitability challenges"
            />
          </TabsContent>
          
          <TabsContent value="decline" className="mt-6">
            <RankingCard
              locations={globalRankings.biggest_decline}
              title="Biggest Habitability Decline"
              icon={TrendingDown}
              description="Cities experiencing the largest drops in habitability"
            />
          </TabsContent>
        </Tabs>
        
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <div className="text-sm text-muted-foreground">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4" />
              Click any city to view its detailed climate projection
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-medium">Score:</span> Current habitability (0-100)
              </div>
              <div>
                <span className="font-medium">Change:</span> Difference from baseline
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}