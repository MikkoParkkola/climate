import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Thermometer, Droplets, Building, AlertTriangle, Waves } from "lucide-react";
import type { ClimateProjection } from "@/types/climate";

interface LivabilityIndexBreakdownProps {
  currentData?: ClimateProjection;
  projectedData?: ClimateProjection;
  selectedYear: number;
}

export default function LivabilityIndexBreakdown({ 
  currentData, 
  projectedData, 
  selectedYear 
}: LivabilityIndexBreakdownProps) {
  const breakdown = projectedData?.habitabilityBreakdown;
  
  if (!breakdown) {
    return (
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">
            Habitability Breakdown ({selectedYear})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-600">No detailed breakdown data available for this projection.</p>
        </CardContent>
      </Card>
    );
  }

  const components = [
    {
      name: "Temperature Comfort",
      value: breakdown.temperature_comfort,
      icon: Thermometer,
      color: "bg-blue-500",
      description: "Climate temperature suitability for human comfort"
    },
    {
      name: "Precipitation Adequacy",
      value: breakdown.precipitation_adequacy,
      icon: Droplets,
      color: "bg-cyan-500",
      description: "Water availability and precipitation patterns"
    },
    {
      name: "Infrastructure Adaptation",
      value: breakdown.infrastructure_adaptation,
      icon: Building,
      color: "bg-green-500",
      description: "Infrastructure capacity to handle climate conditions"
    }
  ];

  const penalties = [
    {
      name: "Heat Stress Penalty",
      value: Math.abs(breakdown.heat_stress_penalty),
      icon: AlertTriangle,
      color: "bg-red-500",
      description: "Reduction due to extreme heat events"
    },
    {
      name: "Drought Penalty",
      value: Math.abs(breakdown.drought_penalty),
      icon: AlertTriangle,
      color: "bg-orange-500",
      description: "Reduction due to water scarcity risks"
    },
    {
      name: "Flood Penalty",
      value: Math.abs(breakdown.flood_penalty),
      icon: Waves,
      color: "bg-indigo-500",
      description: "Reduction due to flooding risks"
    }
  ];

  const maxValue = Math.max(
    ...components.map(c => c.value),
    ...penalties.map(p => p.value),
    20
  );

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 65) return "text-blue-600";
    if (score >= 50) return "text-yellow-600";
    if (score >= 30) return "text-orange-600";
    return "text-red-600";
  };

  const getScoreLevel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 65) return "Good";
    if (score >= 50) return "Moderate";
    if (score >= 30) return "Poor";
    return "Critical";
  };

  return (
    <div className="space-y-6">
      {/* Overall Score Summary */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">
            Habitability Breakdown ({selectedYear})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Base Score</p>
              <p className="text-xl font-semibold text-slate-900">
                {breakdown.base_score.toFixed(1)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-600">Final Score</p>
              <p className={`text-2xl font-bold ${getScoreColor(breakdown.final_score)}`}>
                {breakdown.final_score.toFixed(1)}
              </p>
              <Badge variant="secondary">
                {getScoreLevel(breakdown.final_score)}
              </Badge>
            </div>
          </div>
          
          <Progress 
            value={breakdown.final_score} 
            className="h-3"
          />
        </CardContent>
      </Card>

      {/* Positive Components */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900">
            Positive Factors
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {components.map((component, index) => {
            const Icon = component.icon;
            const percentage = (component.value / maxValue) * 100;
            
            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Icon className="h-4 w-4 text-slate-600" />
                    <span className="text-sm font-medium text-slate-900">
                      {component.name}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">
                    +{component.value.toFixed(1)}
                  </span>
                </div>
                
                <div className="relative">
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div 
                      className={`${component.color} h-2 rounded-full transition-all duration-300`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
                
                <p className="text-xs text-slate-500">
                  {component.description}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Risk Penalties */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900">
            Risk Penalties
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {penalties.map((penalty, index) => {
            const Icon = penalty.icon;
            const percentage = (penalty.value / maxValue) * 100;
            
            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Icon className="h-4 w-4 text-slate-600" />
                    <span className="text-sm font-medium text-slate-900">
                      {penalty.name}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-red-600">
                    -{penalty.value.toFixed(1)}
                  </span>
                </div>
                
                <div className="relative">
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div 
                      className={`${penalty.color} h-2 rounded-full transition-all duration-300`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
                
                <p className="text-xs text-slate-500">
                  {penalty.description}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Stacked Bar Visualization */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900">
            Component Contribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative h-8 bg-slate-200 rounded-lg overflow-hidden">
              {/* Positive components stacked from left */}
              <div className="absolute top-0 left-0 h-full flex">
                {components.map((component, index) => {
                  const width = (component.value / breakdown.base_score) * 100;
                  return (
                    <div
                      key={index}
                      className={`${component.color} h-full flex items-center justify-center text-xs text-white font-medium`}
                      style={{ width: `${width}%` }}
                      title={`${component.name}: +${component.value.toFixed(1)}`}
                    >
                      {width > 15 ? `+${component.value.toFixed(0)}` : ''}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 text-xs">
              {components.map((component, index) => (
                <div key={index} className="flex items-center space-x-1">
                  <div className={`w-3 h-3 ${component.color} rounded`}></div>
                  <span className="text-slate-600">{component.name}</span>
                </div>
              ))}
            </div>
            
            <div className="text-xs text-slate-500 mt-2">
              Base Score: {breakdown.base_score.toFixed(1)} → 
              Final Score: {breakdown.final_score.toFixed(1)} 
              (after penalties: {(breakdown.base_score - breakdown.final_score).toFixed(1)})
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}