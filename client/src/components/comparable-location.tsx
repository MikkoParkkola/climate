import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, ExternalLink, TrendingUp, Thermometer, Droplets, Wind } from "lucide-react";
import type { ClimateProjection } from "@/types/climate";

interface ComparableLocationProps {
  projectedData?: ClimateProjection;
  selectedYear: number;
  onViewLocation?: (latitude: number, longitude: number) => void;
}

export default function ComparableLocation({ projectedData, selectedYear, onViewLocation }: ComparableLocationProps) {
  const getSimilarityLevel = (score?: number) => {
    if (!score) return { level: "Unknown", color: "gray" };
    if (score >= 0.8) return { level: "Very Similar", color: "green" };
    if (score >= 0.6) return { level: "Similar", color: "blue" };
    if (score >= 0.4) return { level: "Somewhat Similar", color: "yellow" };
    return { level: "Different", color: "orange" };
  };

  const similarity = getSimilarityLevel(projectedData?.climateSimilarityScore);
  
  if (!projectedData?.comparableLocationName) {
    return (
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center">
            <MapPin className="text-blue-600 mr-2 h-5 w-5" />
            Climate Analog Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-slate-500 mb-4">
              <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
            </div>
            <p className="text-slate-600 mb-2">Climate analog analysis in progress</p>
            <p className="text-sm text-slate-500">
              Finding present-day locations with similar climate conditions to your projected scenario
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center">
          <MapPin className="text-blue-600 mr-2 h-5 w-5" />
          Climate Analog: Present Day Comparison
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Analog Location Info */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">
                  {projectedData.comparableLocationName}
                </h4>
                <p className="text-sm text-slate-600">
                  {projectedData.comparableLocationCountry}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {projectedData.comparableLocationLat?.toFixed(4)}°, {projectedData.comparableLocationLng?.toFixed(4)}°
                </p>
              </div>
              <Badge className={`${
                similarity.color === 'green' ? 'bg-green-100 text-green-800' :
                similarity.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                similarity.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                'bg-orange-100 text-orange-800'
              }`}>
                {similarity.level}
              </Badge>
            </div>
            
            <div className="text-sm text-slate-700 mb-3">
              <strong>Climate Similarity:</strong> {((projectedData.climateSimilarityScore || 0) * 100).toFixed(0)}% match
            </div>
            
            <p className="text-sm text-slate-600 mb-4">
              This location currently experiences climate conditions similar to what your selected location 
              is projected to have in {selectedYear}. This provides a real-world reference for understanding 
              future climate impacts.
            </p>

            {projectedData.comparableLocationLat && projectedData.comparableLocationLng && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onViewLocation?.(projectedData.comparableLocationLat!, projectedData.comparableLocationLng!)}
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View on Map
              </Button>
            )}
          </div>

          {/* Climate Comparison */}
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-3">
              Current Climate Conditions at Analog Location
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 p-3 rounded-lg">
                <div className="flex items-center mb-2">
                  <Thermometer className="text-red-500 mr-2 h-4 w-4" />
                  <span className="text-xs text-slate-600">Temperature</span>
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  Similar to projected {projectedData.averageTemperature?.toFixed(1)}°C
                </div>
              </div>
              
              <div className="bg-slate-50 p-3 rounded-lg">
                <div className="flex items-center mb-2">
                  <Droplets className="text-blue-500 mr-2 h-4 w-4" />
                  <span className="text-xs text-slate-600">Precipitation</span>
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  Similar to projected {Math.round(projectedData.annualPrecipitation || 0)}mm
                </div>
              </div>
              
              <div className="bg-slate-50 p-3 rounded-lg">
                <div className="flex items-center mb-2">
                  <Wind className="text-green-500 mr-2 h-4 w-4" />
                  <span className="text-xs text-slate-600">Humidity</span>
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  Similar to projected {Math.round(projectedData.humidity || 0)}%
                </div>
              </div>
            </div>
          </div>

          {/* Insights */}
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
            <h4 className="text-sm font-medium text-amber-800 mb-2">
              Climate Analog Insights
            </h4>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• Study current lifestyle adaptations in this region</li>
              <li>• Observe agricultural practices and crop selections</li>
              <li>• Consider infrastructure and building designs</li>
              <li>• Evaluate water management strategies</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}