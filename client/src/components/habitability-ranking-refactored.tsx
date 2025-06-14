import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, MapPin, TrendingDown, Thermometer, Droplets, Building } from "lucide-react";
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

const RankingTable = ({ 
  title, 
  locations, 
  scoreKey, 
  scoreLabel, 
  onLocationClick, 
  icon: Icon,
  citation 
}: {
  title: string;
  locations: GlobalRankedLocation[];
  scoreKey: keyof GlobalRankedLocation;
  scoreLabel: string;
  onLocationClick: (location: GlobalRankedLocation) => void;
  icon: React.ComponentType<{ className?: string }>;
  citation?: string;
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    if (score >= 40) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="w-5 h-5" />
          {title}{citation && <sup>{citation}</sup>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {locations.map((location, index) => {
            const score = location[scoreKey] as number;
            return (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                onClick={() => onLocationClick(location)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-300">
                      {index + 1}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {location.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {location.region}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${getScoreColor(score)}`}>
                    {typeof score === 'number' ? score.toFixed(1) : 'N/A'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {scoreLabel}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

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

  if (isLoading) {
    return (
      <div className="w-full space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-64" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((j) => (
                  <Skeleton key={j} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !globalRankings) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400">
              Failed to load global rankings. Please try again.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Global Climate Rankings - {selectedYear}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Comparative analysis based on CBottle climate model projections
        </p>
      </div>

      {/* Overall Habitability Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RankingTable
          title="Best Overall Habitability"
          locations={globalRankings.best_habitability.slice(0, 5)}
          scoreKey="future_habitability"
          scoreLabel="Habitability Score"
          onLocationClick={handleLocationClick}
          icon={Trophy}
          citation="[20]"
        />
        
        <RankingTable
          title="Worst Overall Habitability"
          locations={globalRankings.worst_habitability.slice(0, 5)}
          scoreKey="future_habitability"
          scoreLabel="Habitability Score"
          onLocationClick={handleLocationClick}
          icon={TrendingDown}
          citation="[21]"
        />
        
        <RankingTable
          title="Biggest Decline"
          locations={globalRankings.biggest_decline.slice(0, 5)}
          scoreKey="habitability_change"
          scoreLabel="Change from Baseline"
          onLocationClick={handleLocationClick}
          icon={TrendingDown}
          citation="[22]"
        />
      </div>

      {/* Specialized Category Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RankingTable
          title="Best Temperature Comfort"
          locations={globalRankings.best_temperature_comfort.slice(0, 5)}
          scoreKey="temperature_comfort"
          scoreLabel="Temperature Score"
          onLocationClick={handleLocationClick}
          icon={Thermometer}
          citation="[23]"
        />
        
        <RankingTable
          title="Best Humidity Conditions"
          locations={globalRankings.best_humidity.slice(0, 5)}
          scoreKey="humidity_score"
          scoreLabel="Humidity Score"
          onLocationClick={handleLocationClick}
          icon={Droplets}
          citation="[24]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RankingTable
          title="Best Infrastructure Adaptation"
          locations={globalRankings.best_infrastructure.slice(0, 5)}
          scoreKey="infrastructure_score"
          scoreLabel="Infrastructure Score"
          onLocationClick={handleLocationClick}
          icon={Building}
        />
        
        <RankingTable
          title="Worst Temperature Comfort"
          locations={globalRankings.worst_temperature_comfort.slice(0, 5)}
          scoreKey="temperature_comfort"
          scoreLabel="Temperature Score"
          onLocationClick={handleLocationClick}
          icon={Thermometer}
        />
      </div>

      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Source Data:</strong> All scores are calculated directly from CBottle climate model 
          projections for {selectedYear}. Temperature comfort, humidity, and infrastructure scores 
          are derived from CBottle's atmospheric physics calculations and baseline meteorological data.
        </p>
      </div>
    </div>
  );
}