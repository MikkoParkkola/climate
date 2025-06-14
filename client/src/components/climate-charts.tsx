import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import Chart from "chart.js/auto";
import type { ClimateProjection } from "@/types/climate";

interface ClimateChartsProps {
  currentData?: ClimateProjection;
  projectedData?: ClimateProjection;
  selectedYear: number;
  onExport?: (type: 'temperature' | 'precipitation') => void;
}

export default function ClimateCharts({ currentData, projectedData, selectedYear, onExport }: ClimateChartsProps) {
  const temperatureChartRef = useRef<HTMLCanvasElement>(null);
  const precipitationChartRef = useRef<HTMLCanvasElement>(null);
  const temperatureChartInstance = useRef<Chart | null>(null);
  const precipitationChartInstance = useRef<Chart | null>(null);

  const parseMonthlyData = (jsonString?: string): number[] => {
    if (!jsonString) return Array(12).fill(0);
    try {
      const data = JSON.parse(jsonString);
      return Array.isArray(data) ? data.slice(0, 12) : Array(12).fill(0);
    } catch {
      return Array(12).fill(0);
    }
  };

  const generateDefaultTemperatureData = (baseTemp: number = 15): number[] => {
    // Generate realistic seasonal temperature variation
    return [
      baseTemp - 3, baseTemp - 1, baseTemp + 1, baseTemp + 3,
      baseTemp + 5, baseTemp + 7, baseTemp + 9, baseTemp + 9,
      baseTemp + 7, baseTemp + 4, baseTemp + 1, baseTemp - 2
    ];
  };

  const generateDefaultPrecipitationData = (basePrecip: number = 50): number[] => {
    // Generate realistic seasonal precipitation variation
    return [
      basePrecip * 1.6, basePrecip * 1.4, basePrecip * 1.2, basePrecip * 0.8,
      basePrecip * 0.4, basePrecip * 0.2, basePrecip * 0.1, basePrecip * 0.2,
      basePrecip * 0.3, basePrecip * 0.7, basePrecip * 1.3, basePrecip * 1.7
    ];
  };

  useEffect(() => {
    if (!temperatureChartRef.current) return;

    // Destroy existing chart
    if (temperatureChartInstance.current) {
      temperatureChartInstance.current.destroy();
    }

    const ctx = temperatureChartRef.current.getContext('2d');
    if (!ctx) return;

    const projectedTemps = projectedData?.monthlyTemperatures ?
      parseMonthlyData(projectedData.monthlyTemperatures) :
      generateDefaultTemperatureData(projectedData?.averageTemperature);

    // Calculate annual temperature change
    const tempChange = projectedData?.temperatureChange || 0;

    temperatureChartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [
          {
            label: `Temperature (${selectedYear})`,
            data: projectedTemps,
            borderColor: '#DC2626',
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            borderWidth: 3,
            tension: 0.3,
            fill: false,
            pointBackgroundColor: '#DC2626',
            pointBorderColor: '#DC2626',
            pointRadius: 4,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}°C`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            title: {
              display: true,
              text: 'Temperature (°C)',
              font: {
                size: 10
              }
            },
            ticks: {
              font: {
                size: 10
              },
              callback: function(value) {
                return value + '°C';
              }
            }
          },
          x: {
            ticks: {
              font: {
                size: 10
              }
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    });

    return () => {
      if (temperatureChartInstance.current) {
        temperatureChartInstance.current.destroy();
      }
    };
  }, [currentData, projectedData, selectedYear]);

  useEffect(() => {
    if (!precipitationChartRef.current) return;

    // Destroy existing chart
    if (precipitationChartInstance.current) {
      precipitationChartInstance.current.destroy();
    }

    const ctx = precipitationChartRef.current.getContext('2d');
    if (!ctx) return;

    const projectedPrecip = projectedData?.monthlyPrecipitation ?
      parseMonthlyData(projectedData.monthlyPrecipitation) :
      generateDefaultPrecipitationData(projectedData?.annualPrecipitation ? projectedData.annualPrecipitation / 12 : undefined);

    // Calculate annual precipitation change
    const precipChange = projectedData?.precipitationChange || 0;

    precipitationChartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [
          {
            label: `Precipitation (${selectedYear})`,
            data: projectedPrecip,
            backgroundColor: 'rgba(37, 99, 235, 0.7)',
            borderColor: '#2563EB',
            borderWidth: 2,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(0)}mm`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Precipitation (mm)',
              font: {
                size: 10
              }
            },
            ticks: {
              font: {
                size: 10
              },
              callback: function(value) {
                return value + 'mm';
              }
            }
          },
          x: {
            ticks: {
              font: {
                size: 10
              }
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    });

    return () => {
      if (precipitationChartInstance.current) {
        precipitationChartInstance.current.destroy();
      }
    };
  }, [currentData, projectedData, selectedYear]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Temperature Projection Chart */}
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-900">Temperature Projection</CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                Monthly
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onExport?.('temperature')}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-slate-50 rounded-lg flex items-center justify-center">
            <canvas ref={temperatureChartRef} className="w-full h-full"></canvas>
          </div>
          <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-600 rounded-full mr-2"></div>
              <span className="text-slate-600">{selectedYear} Projection</span>
            </div>
            <div className="px-3 py-1 bg-red-50 rounded-md">
              <span className="text-red-700 font-medium">
                {projectedData?.temperatureChange ? 
                  `${projectedData.temperatureChange > 0 ? '+' : ''}${projectedData.temperatureChange.toFixed(1)}°C` : 
                  'No change data'
                } vs baseline
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Precipitation Projection Chart */}
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-900">Precipitation Projection</CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                Monthly
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onExport?.('precipitation')}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-slate-50 rounded-lg flex items-center justify-center">
            <canvas ref={precipitationChartRef} className="w-full h-full"></canvas>
          </div>
          <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-600 rounded-full mr-2"></div>
              <span className="text-slate-600">{selectedYear} Projection</span>
            </div>
            <div className="px-3 py-1 bg-blue-50 rounded-md">
              <span className="text-blue-700 font-medium">
                {projectedData?.precipitationChange ? 
                  `${projectedData.precipitationChange > 0 ? '+' : ''}${projectedData.precipitationChange.toFixed(1)}%` : 
                  'No change data'
                } vs baseline
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
