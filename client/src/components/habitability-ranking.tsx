import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, MapPin, TrendingDown, AlertTriangle, Globe, Thermometer, Droplets, Building } from "lucide-react";
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
  temperature_comfort?: number;
  humidity_score?: number;
  infrastructure_score?: number;
  mean_temperature?: number;
  annual_precipitation?: number;
}

interface GlobalRankings {
  best_habitability: GlobalRankedLocation[];
  worst_habitability: GlobalRankedLocation[];
  biggest_decline: GlobalRankedLocation[];
  best_temperature_comfort: GlobalRankedLocation[];
  worst_temperature_comfort: GlobalRankedLocation[];
  best_humidity: GlobalRankedLocation[];
  worst_humidity: GlobalRankedLocation[];
  best_infrastructure: GlobalRankedLocation[];
  worst_infrastructure: GlobalRankedLocation[];
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
    description,
    scoreKey = 'future_habitability',
    showTemperature = false,
    showPrecipitation = false
  }: { 
    locations: GlobalRankedLocation[], 
    title: string, 
    icon: any, 
    description: string,
    scoreKey?: string,
    showTemperature?: boolean,
    showPrecipitation?: boolean
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
                  {showTemperature && location.mean_temperature && (
                    <div className="text-xs text-muted-foreground">
                      {location.mean_temperature.toFixed(1)}°C avg
                    </div>
                  )}
                  {showPrecipitation && location.annual_precipitation && (
                    <div className="text-xs text-muted-foreground">
                      {location.annual_precipitation.toFixed(0)}mm/year
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-semibold ${getScoreColor(location[scoreKey as keyof GlobalRankedLocation] as number)}`}>
                  {((location[scoreKey as keyof GlobalRankedLocation] as number) || 0).toFixed(0)}
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
        <Tabs defaultValue="overall" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overall">Overall Rankings</TabsTrigger>
            <TabsTrigger value="temperature">Temperature Comfort</TabsTrigger>
            <TabsTrigger value="humidity">Humidity</TabsTrigger>
            <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overall" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <RankingCard
                locations={globalRankings.best_habitability}
                title="Most Habitable Regions"
                icon={Trophy}
                description="Regions with highest projected habitability scores"
              />
              <RankingCard
                locations={globalRankings.worst_habitability}
                title="Least Habitable Regions"
                icon={AlertTriangle}
                description="Regions facing significant climate challenges"
              />
              <RankingCard
                locations={globalRankings.biggest_decline}
                title="Biggest Habitability Decline"
                icon={TrendingDown}
                description="Regions experiencing the most severe climate deterioration"
              />
            </div>
          </TabsContent>
          
          <TabsContent value="temperature" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <RankingCard
                locations={globalRankings.best_temperature_comfort}
                title="Best Temperature Comfort"
                icon={Thermometer}
                description="Regions with optimal temperature ranges (15-25°C)"
                scoreKey="temperature_comfort"
                showTemperature={true}
              />
              <RankingCard
                locations={globalRankings.worst_temperature_comfort}
                title="Worst Temperature Comfort"
                icon={AlertTriangle}
                description="Regions with extreme temperature conditions"
                scoreKey="temperature_comfort"
                showTemperature={true}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="humidity" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <RankingCard
                locations={globalRankings.best_humidity}
                title="Best Humidity Balance"
                icon={Droplets}
                description="Regions with optimal precipitation and humidity levels"
                scoreKey="humidity_score"
                showPrecipitation={true}
              />
              <RankingCard
                locations={globalRankings.worst_humidity}
                title="Worst Humidity Conditions"
                icon={AlertTriangle}
                description="Regions with extreme dry or humid conditions"
                scoreKey="humidity_score"
                showPrecipitation={true}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="infrastructure" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <RankingCard
                locations={globalRankings.best_infrastructure}
                title="Best Infrastructure Adaptation"
                icon={Building}
                description="Regions with excellent climate adaptation capabilities"
                scoreKey="infrastructure_score"
              />
              <RankingCard
                locations={globalRankings.worst_infrastructure}
                title="Infrastructure Challenges"
                icon={AlertTriangle}
                description="Regions with limited adaptation infrastructure"
                scoreKey="infrastructure_score"
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}