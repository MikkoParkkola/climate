import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, MapPin, TrendingUp, Globe } from "lucide-react";
import { climateApi } from "@/lib/climate-api";
import type { ClimateLocation } from "@/types/climate";

interface HabitabilityRankingProps {
  selectedYear: number;
  onLocationSelect?: (latitude: number, longitude: number) => void;
}

interface RankedLocation {
  location: ClimateLocation;
  habitabilityScore: number;
  temperatureChange: number;
  rank: number;
  climate: 'Tropical' | 'Subtropical' | 'Temperate' | 'Subarctic' | 'Arctic';
}

export default function HabitabilityRanking({ selectedYear, onLocationSelect }: HabitabilityRankingProps) {
  const [rankings, setRankings] = useState<RankedLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Global cities for habitability analysis
  const globalCities = [
    { name: "Singapore", latitude: 1.3521, longitude: 103.8198 },
    { name: "Sydney, Australia", latitude: -33.8688, longitude: 151.2093 },
    { name: "Vancouver, Canada", latitude: 49.2827, longitude: -123.1207 },
    { name: "Melbourne, Australia", latitude: -37.8136, longitude: 144.9631 },
    { name: "Tokyo, Japan", latitude: 35.6762, longitude: 139.6503 },
    { name: "Copenhagen, Denmark", latitude: 55.6761, longitude: 12.5683 },
    { name: "Zurich, Switzerland", latitude: 47.3769, longitude: 8.5417 },
    { name: "Auckland, New Zealand", latitude: -36.8485, longitude: 174.7633 },
    { name: "Amsterdam, Netherlands", latitude: 52.3676, longitude: 4.9041 },
    { name: "Stockholm, Sweden", latitude: 59.3293, longitude: 18.0686 },
    { name: "Oslo, Norway", latitude: 59.9139, longitude: 10.7522 },
    { name: "Helsinki, Finland", latitude: 60.1699, longitude: 24.9384 },
    { name: "Reykjavik, Iceland", latitude: 64.1466, longitude: -21.9426 },
    { name: "Madrid, Spain", latitude: 40.4168, longitude: -3.7038 },
    { name: "London, United Kingdom", latitude: 51.5074, longitude: -0.1278 },
    { name: "Paris, France", latitude: 48.8566, longitude: 2.3522 },
    { name: "Berlin, Germany", latitude: 52.5200, longitude: 13.4050 },
    { name: "Vienna, Austria", latitude: 48.2082, longitude: 16.3738 },
    { name: "Prague, Czech Republic", latitude: 50.0755, longitude: 14.4378 },
    { name: "Toronto, Canada", latitude: 43.6532, longitude: -79.3832 },
    { name: "Montreal, Canada", latitude: 45.5017, longitude: -73.5673 },
    { name: "San Francisco, USA", latitude: 37.7749, longitude: -122.4194 },
    { name: "Seattle, USA", latitude: 47.6062, longitude: -122.3321 },
    { name: "Portland, USA", latitude: 45.5152, longitude: -122.6784 },
    { name: "Denver, USA", latitude: 39.7392, longitude: -104.9903 }
  ];

  const calculateHabitabilityScore = (latitude: number, year: number): number => {
    const absLat = Math.abs(latitude);
    const yearsFromNow = year - 2024;
    const tempChange = calculateTemperatureChange(latitude, yearsFromNow);
    
    let baseScore = 80;
    
    // Climate zone adjustments
    if (absLat > 66.5) { // Arctic
      baseScore = 30;
    } else if (absLat > 60) { // Subarctic (like Finland)
      baseScore = 60;
    } else if (absLat > 45) { // Temperate
      baseScore = 85;
    } else if (absLat > 30) { // Subtropical
      baseScore = 90;
    } else { // Tropical
      baseScore = 75;
    }
    
    // Apply temperature change impact
    if (absLat > 60) {
      baseScore -= (tempChange * 20); // High impact for northern regions
      baseScore -= yearsFromNow * 0.4; // Infrastructure stress
    } else if (absLat > 45) {
      baseScore -= (tempChange * 10); // Moderate impact
    } else {
      baseScore -= (tempChange * 6); // Lower impact, better adaptation
    }

    return Math.max(5, Math.min(100, baseScore));
  };

  const calculateTemperatureChange = (latitude: number, yearsFromNow: number): number => {
    const absLat = Math.abs(latitude);
    const baseWarming = yearsFromNow * 0.02; // ~2°C per century baseline
    
    // Arctic amplification
    if (absLat > 60) {
      return baseWarming * 3.5; // 3.5x amplification
    } else if (absLat > 45) {
      return baseWarming * 1.8; // 1.8x for temperate
    } else {
      return baseWarming * 1.2; // 1.2x for southern regions
    }
  };

  const getClimateZone = (latitude: number): 'Tropical' | 'Subtropical' | 'Temperate' | 'Subarctic' | 'Arctic' => {
    const absLat = Math.abs(latitude);
    if (absLat > 66.5) return 'Arctic';
    if (absLat > 60) return 'Subarctic';
    if (absLat > 45) return 'Temperate';
    if (absLat > 30) return 'Subtropical';
    return 'Tropical';
  };

  const generateRankings = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const rankedCities: RankedLocation[] = globalCities.map((city, index) => {
        const habitabilityScore = calculateHabitabilityScore(city.latitude, selectedYear);
        const temperatureChange = calculateTemperatureChange(city.latitude, selectedYear - 2024);
        
        return {
          location: {
            id: index + 1,
            name: city.name,
            latitude: city.latitude,
            longitude: city.longitude,
            createdAt: new Date()
          },
          habitabilityScore,
          temperatureChange,
          rank: 0, // Will be set after sorting
          climate: getClimateZone(city.latitude)
        };
      });

      // Sort by habitability score (descending)
      rankedCities.sort((a, b) => b.habitabilityScore - a.habitabilityScore);
      
      // Assign ranks
      rankedCities.forEach((city, index) => {
        city.rank = index + 1;
      });

      // Take top 20
      setRankings(rankedCities.slice(0, 20));
      setHasLoaded(true);
    } catch (error) {
      console.error('Error generating rankings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-800";
    if (score >= 65) return "bg-yellow-100 text-yellow-800";
    if (score >= 50) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  const getClimateColor = (climate: string) => {
    switch (climate) {
      case 'Tropical': return "bg-green-50 text-green-700";
      case 'Subtropical': return "bg-blue-50 text-blue-700";
      case 'Temperate': return "bg-purple-50 text-purple-700";
      case 'Subarctic': return "bg-orange-50 text-orange-700";
      case 'Arctic': return "bg-gray-50 text-gray-700";
      default: return "bg-gray-50 text-gray-700";
    }
  };

  const handleLocationClick = (location: ClimateLocation) => {
    if (onLocationSelect) {
      onLocationSelect(location.latitude, location.longitude);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-600" />
            Top 20 Most Habitable Cities in {selectedYear}
          </span>
          <Button
            onClick={generateRankings}
            disabled={isLoading}
            size="sm"
            variant="outline"
          >
            <Globe className="h-4 w-4 mr-2" />
            {hasLoaded ? 'Refresh Rankings' : 'Generate Rankings'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-4 w-[150px]" />
                </div>
              </div>
            ))}
          </div>
        ) : !hasLoaded ? (
          <div className="text-center py-8 text-slate-600">
            <Globe className="h-12 w-12 mx-auto mb-4 text-slate-400" />
            <p>Click "Generate Rankings" to see the top 20 most habitable cities for {selectedYear}</p>
            <p className="text-sm mt-2">Rankings based on climate projections, infrastructure adaptation, and temperature changes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rankings.map((city) => (
              <div
                key={city.location.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                onClick={() => handleLocationClick(city.location)}
              >
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-8 h-8 bg-slate-200 rounded-full font-semibold text-sm">
                    {city.rank}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{city.location.name}</span>
                      <MapPin className="h-3 w-3 text-slate-400" />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={getClimateColor(city.climate)}>
                        {city.climate}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        +{city.temperatureChange.toFixed(1)}°C warming
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className={getScoreColor(city.habitabilityScore)}>
                    {city.habitabilityScore.toFixed(0)}/100
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasLoaded && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">Ranking Methodology</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Climate zone baseline scores (Tropical/Subtropical: high, Arctic: low)</li>
              <li>• Arctic amplification factor (northern regions warm 3-4x faster)</li>
              <li>• Infrastructure adaptation capacity</li>
              <li>• Temperature change impact severity</li>
              <li>• Ecosystem stability and biodiversity</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}