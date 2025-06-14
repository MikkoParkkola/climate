import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, Calendar } from "lucide-react";
import type { ClimateLocation } from "@/types/climate";

interface ClimateTimelineProps {
  selectedLocation?: ClimateLocation;
  onYearSelect?: (year: number) => void;
}

interface TimelineData {
  year: number;
  temperature: number;
  temperatureChange: number;
  precipitation: number;
  habitability: number;
  heatStress: number;
  drought: number;
  flooding: number;
  biodiversityLoss: number;
}

export default function ClimateTimeline({ selectedLocation, onYearSelect }: ClimateTimelineProps) {
  const [selectedMetric, setSelectedMetric] = useState<'temperature' | 'habitability' | 'risks'>('habitability');

  // Generate timeline data for visualization
  const generateTimelineData = (): TimelineData[] => {
    if (!selectedLocation) return [];

    const data: TimelineData[] = [];
    const baseTemp = getBaseTemperature(selectedLocation.latitude);
    const basePrecip = getBasePrecipitation(selectedLocation.latitude, selectedLocation.longitude);
    
    for (let year = 2025; year <= 2100; year += 5) {
      const yearsFromNow = year - 2024;
      const tempChange = calculateTemperatureChange(selectedLocation.latitude, yearsFromNow);
      const precipChange = calculatePrecipitationChange(selectedLocation.latitude, selectedLocation.longitude, yearsFromNow);
      const habitability = calculateHabitabilityOverTime(selectedLocation.latitude, yearsFromNow);
      
      data.push({
        year,
        temperature: baseTemp + tempChange,
        temperatureChange: tempChange,
        precipitation: basePrecip * (1 + precipChange),
        habitability,
        heatStress: calculateHeatStressRisk(selectedLocation.latitude, tempChange),
        drought: calculateDroughtRisk(selectedLocation.latitude, precipChange),
        flooding: calculateFloodingRisk(selectedLocation.latitude, precipChange),
        biodiversityLoss: calculateBiodiversityLossOverTime(selectedLocation.latitude, yearsFromNow)
      });
    }

    return data;
  };

  const timelineData = generateTimelineData();

  const getBaseTemperature = (latitude: number): number => {
    const absLat = Math.abs(latitude);
    if (absLat > 66.5) return -15; // Arctic
    if (absLat > 60) return -5;    // Subarctic (like Finland)
    if (absLat > 45) return 8;     // Temperate (like Central Europe)
    if (absLat > 30) return 18;    // Subtropical
    return 25; // Tropical
  };

  const getBasePrecipitation = (latitude: number, longitude: number): number => {
    const absLat = Math.abs(latitude);
    if (absLat > 60) return 400;   // Northern regions
    if (absLat > 45) return 600;   // Temperate
    if (absLat > 30) return 800;   // Subtropical
    return 1200; // Tropical
  };

  const calculateTemperatureChange = (latitude: number, yearsFromNow: number): number => {
    const absLat = Math.abs(latitude);
    const baseWarming = yearsFromNow * 0.02; // ~2°C per century baseline
    
    // Arctic amplification: northern regions warm much faster
    if (absLat > 60) {
      return baseWarming * 3.5; // 3.5x amplification for Arctic/Subarctic
    } else if (absLat > 45) {
      return baseWarming * 1.8; // 1.8x for temperate
    } else {
      return baseWarming * 1.2; // 1.2x for southern regions
    }
  };

  const calculatePrecipitationChange = (latitude: number, longitude: number, yearsFromNow: number): number => {
    const absLat = Math.abs(latitude);
    const factor = yearsFromNow * 0.001;
    
    if (absLat > 60) return factor * 0.5; // Northern: modest increase
    if (absLat > 45) return factor * 0.2; // Temperate: slight increase
    return factor * -0.3; // Southern: decrease (drying)
  };

  const calculateHabitabilityOverTime = (latitude: number, yearsFromNow: number): number => {
    const absLat = Math.abs(latitude);
    const tempChange = calculateTemperatureChange(latitude, yearsFromNow);
    
    let baseScore = 80;
    
    // Northern regions face severe challenges from rapid warming
    if (absLat > 60) {
      baseScore = 80 - (tempChange * 15); // Rapid decline
      // Infrastructure not designed for warmer temps
      baseScore -= yearsFromNow * 0.3;
    } else if (absLat > 45) {
      baseScore = 85 - (tempChange * 8); // Moderate decline
    } else {
      baseScore = 75 - (tempChange * 5); // Slower decline
      // Already adapted to heat
    }

    return Math.max(10, Math.min(100, baseScore));
  };

  const calculateHeatStressRisk = (latitude: number, tempChange: number): number => {
    const absLat = Math.abs(latitude);
    if (absLat > 60) {
      // Northern regions have no heat adaptation
      return Math.min(100, tempChange * 25);
    } else if (absLat > 45) {
      return Math.min(100, tempChange * 15);
    } else {
      return Math.min(100, tempChange * 10);
    }
  };

  const calculateDroughtRisk = (latitude: number, precipChange: number): number => {
    const absLat = Math.abs(latitude);
    if (absLat < 45) {
      return Math.min(100, Math.abs(precipChange) * 150);
    }
    return Math.min(100, Math.abs(precipChange) * 80);
  };

  const calculateFloodingRisk = (latitude: number, precipChange: number): number => {
    if (precipChange > 0) {
      return Math.min(100, precipChange * 100);
    }
    return 20; // Base flooding risk
  };

  const calculateBiodiversityLossOverTime = (latitude: number, yearsFromNow: number): number => {
    const absLat = Math.abs(latitude);
    const tempChange = calculateTemperatureChange(latitude, yearsFromNow);
    
    if (absLat > 60) {
      // Arctic ecosystems are extremely sensitive
      return Math.min(80, tempChange * 12);
    } else if (absLat > 45) {
      return Math.min(60, tempChange * 8);
    } else {
      return Math.min(40, tempChange * 5);
    }
  };

  const getHabitabilityColor = (score: number) => {
    if (score >= 70) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    if (score >= 30) return "text-orange-600";
    return "text-red-600";
  };

  const getHabitabilityLabel = (score: number) => {
    if (score >= 70) return "Excellent";
    if (score >= 50) return "Good";
    if (score >= 30) return "Challenging";
    return "Critical";
  };

  if (!selectedLocation) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-slate-500">
          Select a location to view climate timeline
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Climate Timeline: {selectedLocation.name}
          </CardTitle>
          <div className="flex gap-2">
            {(['habitability', 'temperature', 'risks'] as const).map((metric) => (
              <Button
                key={metric}
                variant={selectedMetric === metric ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedMetric(metric)}
              >
                {metric.charAt(0).toUpperCase() + metric.slice(1)}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <>
                {selectedMetric === 'habitability' && (
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(1)}`, "Habitability Score"]}
                      labelFormatter={(year) => `Year: ${year}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="habitability" 
                      stroke="#ef4444" 
                      strokeWidth={3}
                      dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                )}

                {selectedMetric === 'temperature' && (
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        `${value.toFixed(1)}°C`, 
                        name === 'temperature' ? 'Average Temperature' : 'Temperature Change'
                      ]}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="temperature" 
                      stroke="#f97316" 
                      strokeWidth={2}
                      name="Average Temperature"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="temperatureChange" 
                      stroke="#dc2626" 
                      strokeWidth={2}
                      name="Temperature Change"
                    />
                  </LineChart>
                )}

                {selectedMetric === 'risks' && (
                  <AreaChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [`${value.toFixed(1)}`, name]}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="heatStress" 
                      stackId="1"
                      stroke="#ef4444" 
                      fill="#ef4444"
                      fillOpacity={0.3}
                      name="Heat Stress Risk"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="drought" 
                      stackId="1"
                      stroke="#f59e0b" 
                      fill="#f59e0b"
                      fillOpacity={0.3}
                      name="Drought Risk"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="biodiversityLoss" 
                      stackId="1"
                      stroke="#10b981" 
                      fill="#10b981"
                      fillOpacity={0.3}
                      name="Biodiversity Loss"
                    />
                  </AreaChart>
                )}
              </>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Key Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Why Northern Europe Faces Greater Climate Challenges
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <h4 className="font-semibold text-red-800 mb-2">Arctic Amplification Effect</h4>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• Northern regions warm 3-4x faster than global average</li>
                <li>• Finland: +6-8°C by 2070 vs Madrid: +2-3°C</li>
                <li>• Loss of snow/ice reduces solar reflection</li>
                <li>• Permafrost thaw releases methane</li>
              </ul>
            </div>

            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <h4 className="font-semibold text-orange-800 mb-2">Infrastructure Vulnerability</h4>
              <ul className="text-sm text-orange-700 space-y-1">
                <li>• Buildings designed for cold, not heat</li>
                <li>• No air conditioning infrastructure</li>
                <li>• Roads/foundations built on permafrost</li>
                <li>• Energy systems optimized for heating</li>
              </ul>
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h4 className="font-semibold text-yellow-800 mb-2">Ecosystem Disruption</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Boreal forests stressed by heat/drought</li>
                <li>• Traditional agriculture zones shift north</li>
                <li>• Wildlife migration patterns disrupted</li>
                <li>• Lake and river systems altered</li>
              </ul>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">Southern Europe Adaptation</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Already adapted to heat extremes</li>
                <li>• Cooling infrastructure exists</li>
                <li>• Architecture designed for warmth</li>
                <li>• Gradual warming vs rapid change</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-slate-50 rounded-lg">
            <h4 className="font-semibold text-slate-800 mb-3">Timeline Key Impacts for {selectedLocation.name}:</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <strong className="text-slate-700">2030s:</strong>
                <ul className="text-slate-600 mt-1 space-y-1">
                  <li>• +2-3°C warming</li>
                  <li>• Infrastructure stress begins</li>
                  <li>• Energy demand shifts</li>
                </ul>
              </div>
              <div>
                <strong className="text-slate-700">2050s:</strong>
                <ul className="text-slate-600 mt-1 space-y-1">
                  <li>• +4-5°C warming</li>
                  <li>• Major ecosystem changes</li>
                  <li>• Agricultural zone shifts</li>
                </ul>
              </div>
              <div>
                <strong className="text-slate-700">2070s+:</strong>
                <ul className="text-slate-600 mt-1 space-y-1">
                  <li>• +6-8°C warming</li>
                  <li>• Critical infrastructure failure</li>
                  <li>• Fundamental lifestyle changes</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}