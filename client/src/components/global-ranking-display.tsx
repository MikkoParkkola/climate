import { useQuery } from "@tanstack/react-query";

interface GlobalRankingDisplayProps {
  currentScore: number;
  targetYear: number;
  latitude: number;
  longitude: number;
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

export default function GlobalRankingDisplay({ 
  currentScore, 
  targetYear, 
  latitude, 
  longitude 
}: GlobalRankingDisplayProps) {
  const { data: globalRankings, isLoading } = useQuery<GlobalRankings>({
    queryKey: ['/api/climate/global-rankings', targetYear],
    queryFn: async () => {
      const response = await fetch(`/api/climate/global-rankings?year=${targetYear}`);
      if (!response.ok) {
        throw new Error('Failed to fetch global rankings');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="mt-3 flex items-center justify-center">
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
          <p className="text-sm text-gray-600">Loading global rankings...</p>
        </div>
      </div>
    );
  }

  if (!globalRankings) {
    return (
      <div className="mt-3 flex items-center justify-center">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
          <p className="text-sm text-yellow-700">Global rankings unavailable</p>
        </div>
      </div>
    );
  }

  // Calculate accurate ranking position by creating a comprehensive list of all locations
  const allLocations: GlobalRankedLocation[] = [
    ...globalRankings.best_habitability,
    ...globalRankings.worst_habitability,
    ...globalRankings.biggest_decline
  ];

  // Remove duplicates based on coordinates
  const uniqueLocations = allLocations.filter((location, index, self) => 
    index === self.findIndex(l => 
      Math.abs(l.latitude - location.latitude) < 0.1 && 
      Math.abs(l.longitude - location.longitude) < 0.1
    )
  );

  // Sort by habitability score (descending)
  const sortedLocations = uniqueLocations.sort((a, b) => b.future_habitability - a.future_habitability);

  // Find current location's position
  const currentLocationIndex = sortedLocations.findIndex(location => 
    Math.abs(location.latitude - latitude) < 0.5 && 
    Math.abs(location.longitude - longitude) < 0.5
  );

  // Calculate percentile based on actual position
  let rankingText = "Not ranked";
  let rankingColor = "text-gray-700";
  
  if (currentLocationIndex !== -1) {
    const totalLocations = sortedLocations.length;
    const percentile = Math.round(((totalLocations - currentLocationIndex) / totalLocations) * 100);
    
    if (percentile >= 90) {
      rankingText = `Top ${100 - percentile + 1}%`;
      rankingColor = "text-green-700";
    } else if (percentile >= 75) {
      rankingText = `Top ${100 - percentile + 1}%`;
      rankingColor = "text-blue-700";
    } else if (percentile >= 50) {
      rankingText = `Top ${100 - percentile + 1}%`;
      rankingColor = "text-yellow-700";
    } else if (percentile >= 25) {
      rankingText = `Bottom ${percentile}%`;
      rankingColor = "text-orange-700";
    } else {
      rankingText = `Bottom ${percentile}%`;
      rankingColor = "text-red-700";
    }
  } else {
    // Estimate based on score comparison
    const betterLocations = sortedLocations.filter(loc => loc.future_habitability > currentScore);
    const totalLocations = sortedLocations.length;
    
    if (betterLocations.length === 0) {
      rankingText = "Among the best globally";
      rankingColor = "text-green-700";
    } else if (betterLocations.length < totalLocations * 0.1) {
      rankingText = "Top 10%";
      rankingColor = "text-green-700";
    } else if (betterLocations.length < totalLocations * 0.25) {
      rankingText = "Top 25%";
      rankingColor = "text-blue-700";
    } else if (betterLocations.length < totalLocations * 0.5) {
      rankingText = "Top 50%";
      rankingColor = "text-yellow-700";
    } else if (betterLocations.length < totalLocations * 0.75) {
      rankingText = "Bottom 50%";
      rankingColor = "text-orange-700";
    } else {
      rankingText = "Bottom 25%";
      rankingColor = "text-red-700";
    }
  }

  // Find best reference for comparison
  const bestLocation = sortedLocations[0];
  const worstLocation = sortedLocations[sortedLocations.length - 1];

  return (
    <div className="mt-3 flex items-center justify-center">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
        <p className="text-sm text-blue-700 font-medium">
          Global Ranking for {targetYear}<sup>[19]</sup>: <span className={`font-bold ${rankingColor}`}>
            {rankingText}
          </span>
        </p>
        <p className="text-xs text-blue-600 mt-1">
          Grounded score: {currentScore.toFixed(1)}/100 (Best: {bestLocation?.name} {bestLocation?.future_habitability.toFixed(1)},
          Worst: {worstLocation?.name} {worstLocation?.future_habitability.toFixed(1)})
        </p>
      </div>
    </div>
  );
}
