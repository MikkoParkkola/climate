import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Thermometer, Droplets, Home, AlertTriangle, TrendingUp, BarChart3 } from "lucide-react";

interface ComparisonData {
  location: {
    name: string;
    lat: number;
    lng: number;
  };
  temperature: {
    annual_mean: number;
    change_from_baseline: number;
    min: number;
    max: number;
    monthly: number[];
  };
  precipitation: {
    annual_total: number;
    change_from_baseline: number;
    monthly: number[];
  };
  habitability: {
    score: number;
    breakdown: {
      temperature_comfort: number;
      precipitation_adequacy: number;
      infrastructure_adaptation: number;
      heat_stress_penalty: number;
      drought_risk_penalty: number;
      flood_risk_penalty: number;
    };
  };
  extremes: {
    heat_stress_days: number;
    drought_risk: number;
    flood_risk: number;
  };
}

interface ComparisonChartsProps {
  data: ComparisonData[];
  targetYear: number;
}

export default function ComparisonCharts({ data, targetYear }: ComparisonChartsProps) {
  const colors = [
    '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ];

  const getLocationName = (fullName: string) => {
    return fullName.split(',')[0];
  };

  // Temperature Comparison Bar Chart
  const TemperatureComparison = () => {
    const maxTemp = Math.max(...data.map(d => d.temperature.annual_mean));
    const minTemp = Math.min(...data.map(d => d.temperature.annual_mean));
    const tempRange = maxTemp - minTemp || 1;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-red-600" />
            Annual Mean Temperature Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{getLocationName(item.location.name)}</span>
                  <span className="text-sm font-bold" style={{ color: colors[index] }}>
                    {item.temperature.annual_mean?.toFixed(1) || 'N/A'}°C
                  </span>
                </div>
                <div className="relative h-6 bg-gray-100 rounded">
                  <div
                    className="absolute left-0 top-0 h-full rounded transition-all duration-500"
                    style={{
                      width: `${((item.temperature.annual_mean || 0) - minTemp) / tempRange * 100}%`,
                      backgroundColor: colors[index]
                    }}
                  />
                  <div className="absolute right-2 top-1 text-xs text-gray-600">
                    {item.temperature.change_from_baseline && item.temperature.change_from_baseline > 0 ? '+' : ''}{item.temperature.change_from_baseline?.toFixed(1) || 'N/A'}°C change
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Precipitation Comparison
  const PrecipitationComparison = () => {
    const maxPrecip = Math.max(...data.map(d => d.precipitation.annual_total));
    const minPrecip = Math.min(...data.map(d => d.precipitation.annual_total));
    const precipRange = maxPrecip - minPrecip || 1;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-600" />
            Annual Precipitation Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{getLocationName(item.location.name)}</span>
                  <span className="text-sm font-bold" style={{ color: colors[index] }}>
                    {item.precipitation.annual_total?.toFixed(0) || 'N/A'}mm
                  </span>
                </div>
                <div className="relative h-6 bg-gray-100 rounded">
                  <div
                    className="absolute left-0 top-0 h-full rounded transition-all duration-500"
                    style={{
                      width: `${((item.precipitation.annual_total || 0) - minPrecip) / precipRange * 100}%`,
                      backgroundColor: colors[index]
                    }}
                  />
                  <div className="absolute right-2 top-1 text-xs text-gray-600">
                    {item.precipitation.change_from_baseline && item.precipitation.change_from_baseline > 0 ? '+' : ''}{item.precipitation.change_from_baseline?.toFixed(1) || 'N/A'}% change
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Habitability Score Radar/Waterfall Comparison
  const HabitabilityComparison = () => {
    const maxScore = Math.max(...data.map(d => d.habitability.score));
    const minScore = Math.min(...data.map(d => d.habitability.score));

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="w-5 h-5 text-green-600" />
            Habitability Score Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Overall Scores */}
            <div className="space-y-3">
              {data.map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{getLocationName(item.location.name)}</span>
                    <span className="text-sm font-bold" style={{ color: colors[index] }}>
                      {item.habitability.score?.toFixed(1) || 'N/A'}/100
                    </span>
                  </div>
                  <div className="relative h-6 bg-gray-100 rounded">
                    <div
                      className="absolute left-0 top-0 h-full rounded transition-all duration-500"
                      style={{
                        width: `${item.habitability.score || 0}%`,
                        backgroundColor: colors[index]
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Component Breakdown */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Temperature Comfort */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Temperature Comfort</h4>
                {data.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <span style={{ color: colors[index] }}>{getLocationName(item.location.name)}</span>
                    <span className="font-medium">{item.habitability.breakdown?.temperature_comfort?.toFixed(1) || 'N/A'}</span>
                  </div>
                ))}
              </div>

              {/* Precipitation Adequacy */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Precipitation Adequacy</h4>
                {data.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <span style={{ color: colors[index] }}>{getLocationName(item.location.name)}</span>
                    <span className="font-medium">{item.habitability.breakdown?.precipitation_adequacy?.toFixed(1) || 'N/A'}</span>
                  </div>
                ))}
              </div>

              {/* Infrastructure Adaptation */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Infrastructure Adaptation</h4>
                {data.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <span style={{ color: colors[index] }}>{getLocationName(item.location.name)}</span>
                    <span className="font-medium">{item.habitability.breakdown?.infrastructure_adaptation?.toFixed(1) || 'N/A'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Risk Factors Comparison
  const RiskComparison = () => {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Climate Risk Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Heat Stress Days */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Heat Stress Days ({'>'}35°C)</h4>
              {data.map((item, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: colors[index] }}>
                      {getLocationName(item.location.name)}
                    </span>
                    <span className="text-xs font-bold">
                      {item.extremes.heat_stress_days || 0} days
                    </span>
                  </div>
                  <div className="relative h-3 bg-gray-100 rounded">
                    <div
                      className="absolute left-0 top-0 h-full rounded transition-all duration-500"
                      style={{
                        width: `${Math.min((item.extremes.heat_stress_days || 0) / 100 * 100, 100)}%`,
                        backgroundColor: colors[index]
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Drought Risk */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Drought Risk</h4>
              {data.map((item, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: colors[index] }}>
                      {getLocationName(item.location.name)}
                    </span>
                    <span className="text-xs font-bold">
                      {((item.extremes.drought_risk || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="relative h-3 bg-gray-100 rounded">
                    <div
                      className="absolute left-0 top-0 h-full rounded transition-all duration-500"
                      style={{
                        width: `${(item.extremes.drought_risk || 0) * 100}%`,
                        backgroundColor: colors[index]
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Flood Risk */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Flood Risk</h4>
              {data.map((item, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: colors[index] }}>
                      {getLocationName(item.location.name)}
                    </span>
                    <span className="text-xs font-bold">
                      {((item.extremes.flood_risk || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="relative h-3 bg-gray-100 rounded">
                    <div
                      className="absolute left-0 top-0 h-full rounded transition-all duration-500"
                      style={{
                        width: `${(item.extremes.flood_risk || 0) * 100}%`,
                        backgroundColor: colors[index]
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Monthly Temperature Trends
  const MonthlyTemperatureTrends = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            Monthly Temperature Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative h-64 bg-gray-50 rounded-lg p-4">
            {/* Chart area */}
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {data.map((item, dataIndex) => {
                if (!item.temperature.monthly || item.temperature.monthly.length === 0) return null;
                
                const temps = item.temperature.monthly;
                const maxTemp = Math.max(...data.flatMap(d => d.temperature.monthly || []));
                const minTemp = Math.min(...data.flatMap(d => d.temperature.monthly || []));
                const tempRange = maxTemp - minTemp || 1;
                
                const points = temps.map((temp, monthIndex) => {
                  const x = (monthIndex / 11) * 100;
                  const y = 100 - ((temp - minTemp) / tempRange) * 100;
                  return `${x},${y}`;
                }).join(' ');
                
                return (
                  <polyline
                    key={dataIndex}
                    fill="none"
                    stroke={colors[dataIndex]}
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    points={points}
                    opacity="0.8"
                  />
                );
              })}
            </svg>
            
            {/* Legend */}
            <div className="absolute bottom-2 right-2 bg-white p-2 rounded shadow text-xs">
              {data.slice(0, 5).map((item, index) => (
                <div key={index} className="flex items-center gap-1 mb-1">
                  <div 
                    className="w-3 h-0.5 rounded"
                    style={{ backgroundColor: colors[index] }}
                  />
                  <span>{getLocationName(item.location.name)}</span>
                </div>
              ))}
              {data.length > 5 && <div className="text-gray-500">+{data.length - 5} more</div>}
            </div>
            
            {/* X-axis labels */}
            <div className="absolute bottom-0 left-4 right-4 flex justify-between text-xs text-gray-500">
              {months.slice(0, 6).map(month => (
                <span key={month}>{month}</span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Monthly Precipitation Trends
  const MonthlyPrecipitationTrends = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-600" />
            Monthly Precipitation Patterns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative h-64 bg-gray-50 rounded-lg p-4">
            {/* Bar chart visualization */}
            <div className="w-full h-full flex items-end justify-between">
              {months.map((month, monthIndex) => (
                <div key={monthIndex} className="flex flex-col items-center w-8">
                  <div className="relative flex items-end h-48 w-full">
                    {data.map((item, dataIndex) => {
                      if (!item.precipitation.monthly || item.precipitation.monthly.length <= monthIndex) return null;
                      
                      const maxPrecip = Math.max(...data.flatMap(d => d.precipitation.monthly || []));
                      const precipValue = item.precipitation.monthly[monthIndex] || 0;
                      const height = (precipValue / maxPrecip) * 190;
                      
                      return (
                        <div
                          key={dataIndex}
                          className="relative"
                          style={{
                            height: `${height}px`,
                            width: `${100 / data.length}%`,
                            backgroundColor: colors[dataIndex],
                            opacity: 0.7,
                            marginRight: dataIndex < data.length - 1 ? '1px' : '0'
                          }}
                          title={`${getLocationName(item.location.name)}: ${precipValue.toFixed(0)}mm`}
                        />
                      );
                    })}
                  </div>
                  <span className="text-xs text-gray-500 mt-1">{month}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TemperatureComparison />
        <PrecipitationComparison />
      </div>
      
      <HabitabilityComparison />
      
      <RiskComparison />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyTemperatureTrends />
        <MonthlyPrecipitationTrends />
      </div>
    </div>
  );
}