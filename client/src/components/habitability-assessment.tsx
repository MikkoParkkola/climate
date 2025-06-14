import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Home, Waves, TreePine, Droplets, Wind, Sun, AlertTriangle } from "lucide-react";
import type { ClimateProjection } from "@/types/climate";

interface HabitabilityAssessmentProps {
  currentData?: ClimateProjection;
  projectedData?: ClimateProjection;
  selectedYear: number;
}

export default function HabitabilityAssessment({ currentData, projectedData, selectedYear }: HabitabilityAssessmentProps) {
  const getHabitabilityLevel = (score?: number) => {
    if (!score) return { level: "Unknown", color: "gray", description: "Insufficient data" };
    if (score >= 80) return { level: "Excellent", color: "green", description: "Highly suitable for human habitation" };
    if (score >= 65) return { level: "Good", color: "blue", description: "Generally suitable with some considerations" };
    if (score >= 50) return { level: "Moderate", color: "yellow", description: "Challenging but manageable conditions" };
    if (score >= 30) return { level: "Poor", color: "orange", description: "Significant challenges for habitation" };
    return { level: "Critical", color: "red", description: "Extremely difficult living conditions" };
  };

  const getElevationImpact = (change?: number) => {
    if (!change) return { status: "Stable", color: "green", description: "No significant elevation change" };
    if (Math.abs(change) < 0.5) return { status: "Minimal", color: "green", description: `${change > 0 ? '+' : ''}${change.toFixed(2)}m change` };
    if (Math.abs(change) < 2) return { status: "Moderate", color: "yellow", description: `${change > 0 ? '+' : ''}${change.toFixed(2)}m change` };
    return { status: "Significant", color: "red", description: `${change > 0 ? '+' : ''}${change.toFixed(2)}m change` };
  };

  const formatAirQuality = (aqi?: number) => {
    if (!aqi) return { level: "Unknown", color: "gray" };
    if (aqi <= 50) return { level: "Good", color: "green" };
    if (aqi <= 100) return { level: "Moderate", color: "yellow" };
    if (aqi <= 150) return { level: "Unhealthy for Sensitive", color: "orange" };
    if (aqi <= 200) return { level: "Unhealthy", color: "red" };
    return { level: "Hazardous", color: "purple" };
  };

  const habitability = getHabitabilityLevel(projectedData?.habitabilityScore);
  const elevationImpact = getElevationImpact(projectedData?.elevationChange);
  const airQuality = formatAirQuality(projectedData?.airQualityIndex);

  return (
    <div className="space-y-6">
      {/* Overall Habitability Score */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center">
            <Home className="text-blue-600 mr-2 h-5 w-5" />
            Habitability Assessment ({selectedYear})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Overall Livability Score</span>
              <Badge className={`${
                habitability.color === 'green' ? 'bg-green-100 text-green-800' :
                habitability.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                habitability.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                habitability.color === 'orange' ? 'bg-orange-100 text-orange-800' :
                'bg-red-100 text-red-800'
              }`}>
                {habitability.level}
              </Badge>
            </div>
            <Progress
              value={projectedData?.habitabilityScore || 0}
              className="h-3"
            />
            <p className="text-sm text-slate-600">{habitability.description}</p>
          </div>
        </CardContent>
      </Card>

      {/* Environmental Factors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Sea Level & Elevation */}
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center mb-3">
              <Waves className="text-blue-600 mr-2 h-4 w-4" />
              <span className="text-sm font-medium text-slate-700">Sea Level Impact</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">Sea Level Change</span>
                <span className="text-sm font-semibold text-slate-900">
                  {projectedData?.seaLevelChange ? `${projectedData.seaLevelChange > 0 ? '+' : ''}${projectedData.seaLevelChange.toFixed(2)}m` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">Coastal Flooding Risk</span>
                <Badge size="sm" className={`${
                  (projectedData?.coastalFloodingRisk || 0) < 25 ? 'bg-green-100 text-green-800' :
                  (projectedData?.coastalFloodingRisk || 0) < 50 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {projectedData?.coastalFloodingRisk || 0}%
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">Elevation Change</span>
                <Badge size="sm" className={`${
                  elevationImpact.color === 'green' ? 'bg-green-100 text-green-800' :
                  elevationImpact.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {elevationImpact.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Biodiversity & Agriculture */}
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center mb-3">
              <TreePine className="text-green-600 mr-2 h-4 w-4" />
              <span className="text-sm font-medium text-slate-700">Ecosystem Health</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">Biodiversity Loss</span>
                <span className="text-sm font-semibold text-slate-900">
                  {projectedData?.biodiversityLoss ? `${projectedData.biodiversityLoss.toFixed(1)}%` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">Agricultural Viability</span>
                <Progress 
                  value={projectedData?.agriculturalViability || 0}
                  className="h-2 w-16"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">Extreme Weather Events</span>
                <span className="text-sm font-semibold text-slate-900">
                  {projectedData?.extremeWeatherEvents || 0}/year
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Water & Air Quality */}
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center mb-3">
              <Droplets className="text-blue-600 mr-2 h-4 w-4" />
              <span className="text-sm font-medium text-slate-700">Resource Quality</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">Water Stress Level</span>
                <Progress 
                  value={projectedData?.waterStressLevel || 0}
                  className="h-2 w-16"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">Air Quality</span>
                <Badge size="sm" className={`${
                  airQuality.color === 'green' ? 'bg-green-100 text-green-800' :
                  airQuality.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                  airQuality.color === 'orange' ? 'bg-orange-100 text-orange-800' :
                  airQuality.color === 'red' ? 'bg-red-100 text-red-800' :
                  'bg-purple-100 text-purple-800'
                }`}>
                  {airQuality.level}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">AQI Index</span>
                <span className="text-sm font-semibold text-slate-900">
                  {projectedData?.airQualityIndex || 'N/A'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Habitability Comparison */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center">
            <AlertTriangle className="text-orange-600 mr-2 h-5 w-5" />
            Habitability Comparison: Present vs {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3">Current Conditions (2024)</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
                  <span className="text-xs text-slate-600">Habitability Score</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {currentData?.habitabilityScore || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
                  <span className="text-xs text-slate-600">Water Stress</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {currentData?.waterStressLevel || 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
                  <span className="text-xs text-slate-600">Air Quality Index</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {currentData?.airQualityIndex || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3">Projected Conditions ({selectedYear})</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded border border-blue-100">
                  <span className="text-xs text-slate-600">Habitability Score</span>
                  <div className="flex items-center">
                    <span className="text-sm font-semibold text-slate-900 mr-2">
                      {projectedData?.habitabilityScore || 'N/A'}
                    </span>
                    {currentData?.habitabilityScore && projectedData?.habitabilityScore && (
                      <span className={`text-xs ${
                        projectedData.habitabilityScore < currentData.habitabilityScore ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {projectedData.habitabilityScore < currentData.habitabilityScore ? '↓' : '↑'}
                        {Math.abs(projectedData.habitabilityScore - currentData.habitabilityScore)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded border border-blue-100">
                  <span className="text-xs text-slate-600">Water Stress</span>
                  <div className="flex items-center">
                    <span className="text-sm font-semibold text-slate-900 mr-2">
                      {projectedData?.waterStressLevel || 0}%
                    </span>
                    {currentData?.waterStressLevel && projectedData?.waterStressLevel && (
                      <span className={`text-xs ${
                        projectedData.waterStressLevel > currentData.waterStressLevel ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {projectedData.waterStressLevel > currentData.waterStressLevel ? '↑' : '↓'}
                        {Math.abs(projectedData.waterStressLevel - currentData.waterStressLevel)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded border border-blue-100">
                  <span className="text-xs text-slate-600">Air Quality Index</span>
                  <div className="flex items-center">
                    <span className="text-sm font-semibold text-slate-900 mr-2">
                      {projectedData?.airQualityIndex || 'N/A'}
                    </span>
                    {currentData?.airQualityIndex && projectedData?.airQualityIndex && (
                      <span className={`text-xs ${
                        projectedData.airQualityIndex > currentData.airQualityIndex ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {projectedData.airQualityIndex > currentData.airQualityIndex ? '↑' : '↓'}
                        {Math.abs(projectedData.airQualityIndex - currentData.airQualityIndex)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}