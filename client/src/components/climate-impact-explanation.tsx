import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ThermometerSun, Droplets, Home, Leaf, Users } from "lucide-react";
import type { ClimateProjection, ClimateLocation } from "@/types/climate";

interface ClimateImpactExplanationProps {
  currentData?: ClimateProjection;
  projectedData?: ClimateProjection;
  selectedLocation?: ClimateLocation;
  selectedYear: number;
}

export default function ClimateImpactExplanation({ 
  currentData, 
  projectedData, 
  selectedLocation,
  selectedYear 
}: ClimateImpactExplanationProps) {
  if (!selectedLocation || !projectedData) {
    return null;
  }

  const tempChange = projectedData.temperatureChange || 0;
  const precipChange = projectedData.precipitationChange || 0;
  const habitabilityScore = projectedData.habitabilityScore || 50;
  const latitude = Math.abs(selectedLocation.latitude);

  // Determine climate zone impact category
  const getClimateZone = () => {
    if (latitude > 66.5) return "Arctic";
    if (latitude > 60) return "Subarctic";
    if (latitude > 45) return "Temperate";
    if (latitude > 30) return "Subtropical";
    return "Tropical";
  };

  const climateZone = getClimateZone();
  const isNorthern = latitude > 60;

  const getHabitabilityStatus = () => {
    if (habitabilityScore >= 70) return { label: "Excellent", color: "bg-green-100 text-green-800" };
    if (habitabilityScore >= 50) return { label: "Good", color: "bg-yellow-100 text-yellow-800" };
    if (habitabilityScore >= 30) return { label: "Challenging", color: "bg-orange-100 text-orange-800" };
    return { label: "Critical", color: "bg-red-100 text-red-800" };
  };

  const habitabilityStatus = getHabitabilityStatus();

  const getPracticalImpacts = () => {
    const impacts = [];

    if (isNorthern) {
      impacts.push({
        category: "Infrastructure",
        icon: Home,
        severity: tempChange > 4 ? "Critical" : tempChange > 2 ? "High" : "Moderate",
        items: [
          `Buildings designed for -20°C now face +${(tempChange - 5).toFixed(1)}°C summers`,
          "No air conditioning infrastructure in most buildings",
          "Road surfaces and foundations not designed for heat cycles",
          "Energy grid optimized for heating, not cooling demand",
          "Permafrost thaw threatens building foundations"
        ]
      });

      impacts.push({
        category: "Daily Life",
        icon: Users,
        severity: tempChange > 5 ? "Critical" : "High",
        items: [
          "Extreme heat waves in regions with no cooling infrastructure",
          "Traditional clothing and lifestyle not adapted to heat",
          "Outdoor work becomes dangerous during summer months",
          "Public transport systems lack adequate cooling",
          "Elderly and vulnerable populations at severe risk"
        ]
      });

      impacts.push({
        category: "Environment",
        icon: Leaf,
        severity: "Critical",
        items: [
          "Boreal forests stressed by unprecedented heat and drought",
          "Traditional agriculture zones become unsuitable",
          "Wildlife migration patterns completely disrupted",
          "Lakes and rivers experience thermal stress",
          "Biodiversity loss accelerates as ecosystems collapse"
        ]
      });
    } else {
      impacts.push({
        category: "Adaptation Advantage",
        icon: Home,
        severity: "Manageable",
        items: [
          "Buildings already designed with heat management",
          "Existing air conditioning and cooling infrastructure",
          "Cultural practices adapted to warm weather",
          "Energy systems designed for cooling demand",
          "Gradual temperature increase vs dramatic shifts"
        ]
      });

      impacts.push({
        category: "Moderate Challenges",
        icon: ThermometerSun,
        severity: tempChange > 3 ? "High" : "Moderate",
        items: [
          "Some increase in extreme heat days",
          "Slightly higher cooling costs",
          "Potential water stress during peak summer",
          "Tourism patterns may shift seasonally",
          "Agricultural adjustments needed for some crops"
        ]
      });
    }

    return impacts;
  };

  const practicalImpacts = getPracticalImpacts();

  const getWhyNorthernIsWorse = () => {
    return [
      {
        title: "Arctic Amplification",
        description: "Northern regions warm 3-4x faster than the global average due to ice-albedo feedback",
        detail: `${selectedLocation.name} will experience ${tempChange.toFixed(1)}°C warming vs ~${(tempChange/3).toFixed(1)}°C for southern Europe`
      },
      {
        title: "Infrastructure Mismatch",
        description: "Buildings and systems designed for extreme cold, not heat",
        detail: "No cooling infrastructure, heat-resistant materials, or hot weather building codes"
      },
      {
        title: "Ecosystem Vulnerability",
        description: "Arctic and boreal ecosystems extremely sensitive to temperature changes",
        detail: "2-3°C warming can trigger complete ecosystem collapse vs gradual adaptation in temperate zones"
      },
      {
        title: "Social Adaptation Gap",
        description: "Populations have no cultural or behavioral adaptation to extreme heat",
        detail: "Clothing, work schedules, and lifestyle completely unsuited to hot weather"
      }
    ];
  };

  const whyNorthernIsWorse = getWhyNorthernIsWorse();

  return (
    <div className="space-y-6">
      {/* Habitability Score Explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Habitability Assessment: {selectedLocation.name}</span>
            <Badge className={habitabilityStatus.color}>
              {habitabilityScore.toFixed(0)}/100 - {habitabilityStatus.label}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <ThermometerSun className="h-8 w-8 text-red-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-red-600">+{tempChange.toFixed(1)}°C</div>
              <div className="text-sm text-red-700">Temperature Increase</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Droplets className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-600">{(precipChange * 100).toFixed(1)}%</div>
              <div className="text-sm text-blue-700">Precipitation Change</div>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <AlertTriangle className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-slate-600">{climateZone}</div>
              <div className="text-sm text-slate-700">Climate Zone</div>
            </div>
          </div>

          <div className="text-sm text-slate-600">
            <p>
              The habitability score combines temperature stress, infrastructure readiness, ecosystem stability, 
              and adaptation capacity. {isNorthern ? "Northern regions" : "Southern regions"} face 
              {isNorthern ? " unprecedented challenges" : " manageable adaptation requirements"} 
              due to {isNorthern ? "rapid warming and lack of heat adaptation" : "existing heat infrastructure and gradual changes"}.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Why Northern Europe is Worse */}
      {isNorthern && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Why Northern Europe Faces Greater Climate Risks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {whyNorthernIsWorse.map((reason, index) => (
                <div key={index} className="border-l-4 border-amber-500 pl-4">
                  <h4 className="font-semibold text-slate-800">{reason.title}</h4>
                  <p className="text-sm text-slate-600 mb-1">{reason.description}</p>
                  <p className="text-xs text-amber-700 font-medium">{reason.detail}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Practical Impacts */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          Practical Impacts by {selectedYear}
        </h3>
        
        {practicalImpacts.map((impact, index) => {
          const IconComponent = impact.icon;
          const severityColor = impact.severity === "Critical" ? "border-red-500 bg-red-50" :
                               impact.severity === "High" ? "border-orange-500 bg-orange-50" :
                               impact.severity === "Moderate" ? "border-yellow-500 bg-yellow-50" :
                               "border-green-500 bg-green-50";
          
          return (
            <Card key={index} className={`border-2 ${severityColor}`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-base">
                  <IconComponent className="h-5 w-5" />
                  {impact.category}
                  <Badge variant="outline" className="ml-auto">
                    {impact.severity}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2 text-sm">
                  {impact.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start gap-2">
                      <span className="text-slate-400 mt-1">•</span>
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Comparison with Southern Europe */}
      <Card className="bg-slate-50">
        <CardHeader>
          <CardTitle className="text-base">
            Why Southern European Cities (Madrid, Amsterdam) Score Better
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-green-800 mb-2">Built-in Adaptation</h4>
              <ul className="space-y-1 text-green-700">
                <li>• Buildings designed for heat management</li>
                <li>• Extensive air conditioning infrastructure</li>
                <li>• Cultural practices for hot weather</li>
                <li>• Heat-resistant urban planning</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-green-800 mb-2">Gradual Change</h4>
              <ul className="space-y-1 text-green-700">
                <li>• Slower warming rate (1-2°C vs 4-6°C)</li>
                <li>• Ecosystems adapted to temperature variation</li>
                <li>• Existing water management systems</li>
                <li>• Established heat wave protocols</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}