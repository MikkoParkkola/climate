import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Thermometer, Droplets, Wind, Waves, AlertTriangle } from "lucide-react";
import type { ClimateProjection } from "@/types/climate";

interface ClimateSummaryProps {
  currentData?: ClimateProjection;
  projectedData?: ClimateProjection;
  selectedYear: number;
}

export default function ClimateSummary({ currentData, projectedData, selectedYear }: ClimateSummaryProps) {
  const formatTemperature = (temp?: number) => temp ? `${temp.toFixed(1)}°C` : "N/A";
  const formatPrecipitation = (precip?: number) => precip ? `${Math.round(precip)}mm` : "N/A";
  const formatPercentage = (val?: number) => val ? `${Math.round(val)}%` : "N/A";
  const formatSeaLevel = (level?: number) => level ? `${level.toFixed(2)}m` : "N/A";

  const formatChange = (change?: number, unit: string = "") => {
    if (!change) return "";
    const sign = change > 0 ? "+" : "";
    return `${sign}${change.toFixed(1)}${unit}`;
  };

  const getRiskLevel = (risk?: number) => {
    if (!risk) return { level: "Unknown", color: "gray" };
    if (risk >= 75) return { level: "High", color: "red" };
    if (risk >= 50) return { level: "Medium", color: "orange" };
    if (risk >= 25) return { level: "Low-Medium", color: "yellow" };
    return { level: "Low", color: "green" };
  };

  const getRiskColor = (risk?: number) => {
    if (!risk) return "bg-gray-600";
    if (risk >= 75) return "bg-red-600";
    if (risk >= 50) return "bg-orange-600";
    if (risk >= 25) return "bg-yellow-600";
    return "bg-green-600";
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      {/* Current Climate Summary */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center">
            <Thermometer className="text-red-600 mr-2 h-5 w-5" />
            Current Climate (2024)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
            <span className="text-sm text-slate-600">Average Temperature</span>
            <span className="font-semibold text-slate-900">
              {formatTemperature(currentData?.averageTemperature)}
            </span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
            <span className="text-sm text-slate-600">Annual Precipitation</span>
            <span className="font-semibold text-slate-900">
              {formatPrecipitation(currentData?.annualPrecipitation)}
            </span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
            <span className="text-sm text-slate-600">Humidity</span>
            <span className="font-semibold text-slate-900">
              {formatPercentage(currentData?.humidity)}
            </span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
            <span className="text-sm text-slate-600">Sea Level</span>
            <span className="font-semibold text-slate-900">
              {formatSeaLevel(currentData?.seaLevel)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Projected Climate Summary */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center">
            <Wind className="text-blue-600 mr-2 h-5 w-5" />
            Projected Climate ({selectedYear})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
            <span className="text-sm text-slate-600">Average Temperature</span>
            <div className="text-right">
              <span className="font-semibold text-slate-900">
                {formatTemperature(projectedData?.averageTemperature)}
              </span>
              {projectedData?.temperatureChange && (
                <div className="text-xs text-red-600">
                  {formatChange(projectedData.temperatureChange, "°C")}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
            <span className="text-sm text-slate-600">Annual Precipitation</span>
            <div className="text-right">
              <span className="font-semibold text-slate-900">
                {formatPrecipitation(projectedData?.annualPrecipitation)}
              </span>
              {projectedData?.precipitationChange && (
                <div className={`text-xs ${projectedData.precipitationChange < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatChange(projectedData.precipitationChange, "mm")}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
            <span className="text-sm text-slate-600">Humidity</span>
            <div className="text-right">
              <span className="font-semibold text-slate-900">
                {formatPercentage(projectedData?.humidity)}
              </span>
              {projectedData?.humidityChange && (
                <div className={`text-xs ${projectedData.humidityChange < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatChange(projectedData.humidityChange, "%")}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
            <span className="text-sm text-slate-600">Sea Level</span>
            <div className="text-right">
              <span className="font-semibold text-slate-900">
                {formatSeaLevel(projectedData?.seaLevel)}
              </span>
              {projectedData?.seaLevelChange && (
                <div className="text-xs text-red-600">
                  {formatChange(projectedData.seaLevelChange, "m")}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Assessment */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center">
            <AlertTriangle className="text-orange-600 mr-2 h-5 w-5" />
            Climate Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Heat Stress Risk */}
          <div className="p-3 bg-red-50 rounded-lg border border-red-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-red-800">Heat Stress</span>
              <span className={`text-xs px-2 py-1 rounded ${
                getRiskLevel(projectedData?.heatStressRisk).color === 'red' ? 'bg-red-200 text-red-800' :
                getRiskLevel(projectedData?.heatStressRisk).color === 'orange' ? 'bg-orange-200 text-orange-800' :
                getRiskLevel(projectedData?.heatStressRisk).color === 'yellow' ? 'bg-yellow-200 text-yellow-800' :
                'bg-green-200 text-green-800'
              }`}>
                {getRiskLevel(projectedData?.heatStressRisk).level}
              </span>
            </div>
            <Progress
              value={projectedData?.heatStressRisk || 0}
              className="h-2"
            />
          </div>
          
          {/* Drought Risk */}
          <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-orange-800">Drought Risk</span>
              <span className={`text-xs px-2 py-1 rounded ${
                getRiskLevel(projectedData?.droughtRisk).color === 'red' ? 'bg-red-200 text-red-800' :
                getRiskLevel(projectedData?.droughtRisk).color === 'orange' ? 'bg-orange-200 text-orange-800' :
                getRiskLevel(projectedData?.droughtRisk).color === 'yellow' ? 'bg-yellow-200 text-yellow-800' :
                'bg-green-200 text-green-800'
              }`}>
                {getRiskLevel(projectedData?.droughtRisk).level}
              </span>
            </div>
            <Progress
              value={projectedData?.droughtRisk || 0}
              className="h-2"
            />
          </div>
          
          {/* Flooding Risk */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-800">Flooding</span>
              <span className={`text-xs px-2 py-1 rounded ${
                getRiskLevel(projectedData?.floodingRisk).color === 'red' ? 'bg-red-200 text-red-800' :
                getRiskLevel(projectedData?.floodingRisk).color === 'orange' ? 'bg-orange-200 text-orange-800' :
                getRiskLevel(projectedData?.floodingRisk).color === 'yellow' ? 'bg-yellow-200 text-yellow-800' :
                'bg-green-200 text-green-800'
              }`}>
                {getRiskLevel(projectedData?.floodingRisk).level}
              </span>
            </div>
            <Progress
              value={projectedData?.floodingRisk || 0}
              className="h-2"
            />
          </div>

          <div className="pt-3 border-t border-slate-200">
            <div className="text-xs text-slate-600 text-center">
              Risk assessment based on IPCC projections
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
