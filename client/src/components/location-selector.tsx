import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Search, MapPin, TrendingUp, Scale } from "lucide-react";
import { geocodingUtils } from "@/lib/climate-api";
import type { ClimateLocation } from "@/types/climate";

interface LocationSelectorProps {
  selectedLocation?: ClimateLocation;
  selectedYear: number;
  onLocationChange: (location: ClimateLocation) => void;
  onLocationSelect: (latitude: number, longitude: number) => void;
  onYearChange: (year: number) => void;
  onGetProjection: () => void;
  onCompareMode: () => void;
  isLoading?: boolean;
}

const MIN_YEAR = 2025;
const MAX_YEAR = 2100;

export default function LocationSelector({
  selectedLocation,
  selectedYear,
  onLocationChange,
  onLocationSelect,
  onYearChange,
  onGetProjection,
  onCompareMode,
  isLoading = false
}: LocationSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{name: string, latitude: number, longitude: number}>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const results = await geocodingUtils.searchLocations(query);
      setSearchResults(results);
      setShowResults(true);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, handleSearch]);

  const handleSelectSearchResult = (result: {name: string, latitude: number, longitude: number}) => {
    console.log('Search result selected:', result);
    
    // Call the location creation flow directly
    onLocationSelect(result.latitude, result.longitude);
    
    setSearchQuery("");
    setShowResults(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Select Location & Time</h2>
        
        {/* Location Search */}
        <div className="space-y-4">
          <div className="relative">
            <Label htmlFor="location-search" className="block text-sm font-medium text-slate-700 mb-2">
              Search Location
            </Label>
            <div className="relative">
              <Input
                id="location-search"
                type="text"
                placeholder="Enter city, country, or coordinates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>
            
            {/* Search Results Dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectSearchResult(result)}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none border-b border-slate-100 last:border-b-0"
                  >
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 text-slate-400 mr-2 flex-shrink-0" />
                      <span className="text-sm text-slate-900 truncate">{result.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Current Selection Display */}
          {selectedLocation && (
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4">
                <div className="text-sm font-medium text-slate-700 mb-2">Selected Location</div>
                <div className="space-y-1">
                  <div className="font-mono text-sm text-slate-900">{selectedLocation.name}</div>
                  <div className="font-mono text-xs text-slate-600">
                    {selectedLocation.latitude.toFixed(4)}° N, {selectedLocation.longitude.toFixed(4)}° W
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Time Horizon Selector */}
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-3">
              Projection Year: {selectedYear}
            </Label>
            <div className="space-y-4">
              <Slider
                value={[selectedYear]}
                onValueChange={(values) => onYearChange(values[0])}
                min={MIN_YEAR}
                max={MAX_YEAR}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>{MIN_YEAR}</span>
                <span>Present + {selectedYear - 2024} years</span>
                <span>{MAX_YEAR}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onYearChange(2030)}
                  className="text-xs"
                >
                  2030
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onYearChange(2050)}
                  className="text-xs"
                >
                  2050
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onYearChange(2100)}
                  className="text-xs"
                >
                  2100
                </Button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            <Button
              onClick={onGetProjection}
              disabled={!selectedLocation || isLoading}
              className="w-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Loading...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Get Climate Projection
                </>
              )}
            </Button>
            <Button
              onClick={onCompareMode}
              variant="outline"
              className="w-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <Scale className="h-4 w-4 mr-2" />
              Compare Locations
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
