import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Info, Thermometer, Droplets, Wind, Home, Sprout, AlertTriangle, BarChart3 } from "lucide-react";
import type { ClimateProjection } from "@/types/climate";

interface LivabilityIndexBreakdownProps {
  currentData?: ClimateProjection;
  projectedData?: ClimateProjection;
  selectedYear: number;
  className?: string;
}

interface IndexComponent {
  name: string;
  current: number;
  projected: number;
  weight: number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  interpretation: {
    excellent: string;
    good: string;
    fair: string;
    poor: string;
  };
}

export default function LivabilityIndexBreakdown({ 
  currentData, 
  projectedData, 
  selectedYear,
  className = "" 
}: LivabilityIndexBreakdownProps) {
  const [viewMode, setViewMode] = useState<'overview' | 'components'>('overview');
  
  const calculateComponentScore = (value: number, min: number, max: number, invert = false): number => {
    const normalized = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    return invert ? 100 - normalized : normalized;
  };

  // Stacked bar component for habitability breakdown
  const HabitabilityStackedBar = ({ 
    breakdown, 
    title 
  }: { 
    breakdown: any, 
    title: string 
  }) => {
    if (!breakdown) return null;

    const components = [
      { 
        key: 'temperature_comfort', 
        label: 'Temperature Comfort', 
        color: 'bg-blue-500', 
        value: breakdown.temperature_comfort || 0 
      },
      { 
        key: 'precipitation_adequacy', 
        label: 'Water Adequacy', 
        color: 'bg-cyan-500', 
        value: breakdown.precipitation_adequacy || 0 
      },
      { 
        key: 'infrastructure_adaptation', 
        label: 'Infrastructure', 
        color: 'bg-green-500', 
        value: breakdown.infrastructure_adaptation || 0 
      },
      { 
        key: 'heat_stress_penalty', 
        label: 'Heat Stress', 
        color: 'bg-red-500', 
        value: Math.abs(breakdown.heat_stress_penalty || 0) 
      },
      { 
        key: 'drought_penalty', 
        label: 'Drought Risk', 
        color: 'bg-orange-500', 
        value: Math.abs(breakdown.drought_penalty || 0) 
      },
      { 
        key: 'flood_penalty', 
        label: 'Flood Risk', 
        color: 'bg-purple-500', 
        value: Math.abs(breakdown.flood_penalty || 0) 
      }
    ];

    const maxValue = Math.max(100, Math.abs(breakdown.base_score || 0));
    
    return (
      <div className="space-y-3">
        <h4 className="font-medium text-sm">{title}</h4>
        <div className="space-y-2">
          {components.map((component) => (
            <div key={component.key} className="flex items-center gap-3">
              <div className="w-20 text-xs text-muted-foreground truncate">
                {component.label}
              </div>
              <div className="flex-1 relative h-4 bg-muted rounded">
                <div 
                  className={`h-full rounded ${component.color} transition-all duration-300`}
                  style={{ 
                    width: `${Math.min(100, (component.value / maxValue) * 100)}%` 
                  }}
                />
              </div>
              <div className="w-12 text-xs text-right">
                {component.value.toFixed(1)}
              </div>
            </div>
          ))}
          <div className="mt-3 pt-2 border-t">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Final Score:</span>
              <span className={`${breakdown.final_score >= 70 ? 'text-green-600' : breakdown.final_score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {breakdown.final_score?.toFixed(1) || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getIndexComponents = (): IndexComponent[] => {
    if (!currentData || !projectedData) return [];

    return [
      {
        name: "Temperature Stability",
        current: calculateComponentScore(Math.abs(currentData.temperatureChange || 0), 0, 5, true),
        projected: calculateComponentScore(Math.abs(projectedData.temperatureChange || 0), 0, 5, true),
        weight: 25,
        icon: Thermometer,
        description: "Measures climate temperature stability and deviation from historical norms",
        interpretation: {
          excellent: "Minimal temperature change (<1°C)",
          good: "Moderate temperature change (1-2°C)",
          fair: "Significant temperature change (2-3°C)",
          poor: "Extreme temperature change (>3°C)"
        }
      },
      {
        name: "Water Security",
        current: calculateComponentScore(currentData.waterStressLevel || 0, 0, 100, true),
        projected: calculateComponentScore(projectedData.waterStressLevel || 0, 0, 100, true),
        weight: 20,
        icon: Droplets,
        description: "Evaluates water availability, drought risk, and precipitation patterns",
        interpretation: {
          excellent: "Low water stress, reliable supply",
          good: "Moderate water stress, generally adequate",
          fair: "High water stress, seasonal shortages",
          poor: "Extreme water stress, severe shortages"
        }
      },
      {
        name: "Air Quality",
        current: calculateComponentScore(currentData.airQualityIndex || 50, 0, 150, true),
        projected: calculateComponentScore(projectedData.airQualityIndex || 50, 0, 150, true),
        weight: 15,
        icon: Wind,
        description: "Assesses air pollution levels and respiratory health impacts",
        interpretation: {
          excellent: "Clean air, minimal health impact",
          good: "Good air quality, low health risk",
          fair: "Moderate pollution, some health concerns",
          poor: "Poor air quality, significant health risks"
        }
      },
      {
        name: "Housing Viability",
        current: calculateComponentScore(currentData.extremeWeatherEvents || 0, 0, 10, true),
        projected: calculateComponentScore(projectedData.extremeWeatherEvents || 0, 0, 10, true),
        weight: 15,
        icon: Home,
        description: "Considers infrastructure resilience and extreme weather frequency",
        interpretation: {
          excellent: "Minimal extreme weather, stable infrastructure",
          good: "Occasional extreme weather, resilient infrastructure",
          fair: "Regular extreme weather, some infrastructure stress",
          poor: "Frequent extreme weather, infrastructure at risk"
        }
      },
      {
        name: "Agricultural Potential",
        current: calculateComponentScore(currentData.agriculturalViability || 50, 0, 100),
        projected: calculateComponentScore(projectedData.agriculturalViability || 50, 0, 100),
        weight: 15,
        icon: Sprout,
        description: "Evaluates food security and agricultural productivity potential",
        interpretation: {
          excellent: "High agricultural productivity, food security",
          good: "Good agricultural conditions, stable food supply",
          fair: "Moderate agricultural challenges, some food concerns",
          poor: "Poor agricultural conditions, food insecurity"
        }
      },
      {
        name: "Natural Disaster Risk",
        current: calculateComponentScore((currentData.floodingRisk || 0) + (currentData.coastalFloodingRisk || 0), 0, 200, true),
        projected: calculateComponentScore((projectedData.floodingRisk || 0) + (projectedData.coastalFloodingRisk || 0), 0, 200, true),
        weight: 10,
        icon: AlertTriangle,
        description: "Assesses flooding, coastal inundation, and other disaster risks",
        interpretation: {
          excellent: "Very low disaster risk",
          good: "Low disaster risk, minimal threats",
          fair: "Moderate disaster risk, some preparation needed",
          poor: "High disaster risk, significant threats"
        }
      }
    ];
  };

  const components = getIndexComponents();
  
  const calculateOverallScore = (isProjected = false): number => {
    if (!components.length) return 0;
    
    const weightedSum = components.reduce((sum, component) => {
      const score = isProjected ? component.projected : component.current;
      return sum + (score * component.weight / 100);
    }, 0);
    
    return Math.round(weightedSum);
  };

  const currentScore = calculateOverallScore(false);
  const projectedScore = calculateOverallScore(true);
  const scoreChange = projectedScore - currentScore;

  const getScoreColor = (score: number): string => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Poor";
  };

  const getComponentInterpretation = (component: IndexComponent, score: number): string => {
    if (score >= 80) return component.interpretation.excellent;
    if (score >= 60) return component.interpretation.good;
    if (score >= 40) return component.interpretation.fair;
    return component.interpretation.poor;
  };

  if (!currentData || !projectedData) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Livability Index Breakdown</CardTitle>
          <CardDescription>
            Select a location to view detailed livability metrics
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          Livability Index Breakdown
        </CardTitle>
        <CardDescription>
          Detailed analysis of factors contributing to the overall livability score
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Component Details</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${getScoreColor(currentScore)}`}>
                    {currentScore}/100
                  </div>
                  <div className="text-sm text-muted-foreground">Current (2024)</div>
                  <Badge variant="outline" className="mt-1">
                    {getScoreLabel(currentScore)}
                  </Badge>
                </div>
              </Card>

              <Card className="p-4">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${getScoreColor(projectedScore)}`}>
                    {projectedScore}/100
                  </div>
                  <div className="text-sm text-muted-foreground">Projected ({selectedYear})</div>
                  <Badge variant="outline" className="mt-1">
                    {getScoreLabel(projectedScore)}
                  </Badge>
                </div>
              </Card>

              <Card className="p-4">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${scoreChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {scoreChange >= 0 ? '+' : ''}{scoreChange}
                  </div>
                  <div className="text-sm text-muted-foreground">Change</div>
                  <Badge variant={scoreChange >= 0 ? "secondary" : "destructive"} className="mt-1">
                    {scoreChange >= 0 ? 'Improving' : 'Declining'}
                  </Badge>
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Component Scores</h4>
              {components.map((component, index) => {
                const Icon = component.icon;
                const change = component.projected - component.current;
                
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="font-medium">{component.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {component.weight}% weight
                        </Badge>
                      </div>
                      <div className="text-sm">
                        <span className={getScoreColor(component.current)}>
                          {Math.round(component.current)}
                        </span>
                        <span className="text-muted-foreground mx-1">→</span>
                        <span className={getScoreColor(component.projected)}>
                          {Math.round(component.projected)}
                        </span>
                        <span className={`ml-2 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ({change >= 0 ? '+' : ''}{Math.round(change)})
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Current</span>
                        <span>Projected</span>
                      </div>
                      <div className="relative">
                        <Progress value={component.current} className="h-2" />
                        <Progress 
                          value={component.projected} 
                          className="h-2 absolute top-0 opacity-60" 
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            {components.map((component, index) => {
              const Icon = component.icon;
              const currentInterpretation = getComponentInterpretation(component, component.current);
              const projectedInterpretation = getComponentInterpretation(component, component.projected);
              
              return (
                <Card key={index} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5" />
                      <h4 className="font-semibold">{component.name}</h4>
                      <Badge variant="outline">{component.weight}% of total score</Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      {component.description}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Current (2024)</span>
                          <span className={`font-bold ${getScoreColor(component.current)}`}>
                            {Math.round(component.current)}/100
                          </span>
                        </div>
                        <Progress value={component.current} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                          {currentInterpretation}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Projected ({selectedYear})</span>
                          <span className={`font-bold ${getScoreColor(component.projected)}`}>
                            {Math.round(component.projected)}/100
                          </span>
                        </div>
                        <Progress value={component.projected} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                          {projectedInterpretation}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}