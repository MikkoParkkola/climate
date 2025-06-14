export interface ClimateLocation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  region?: string;
  createdAt?: Date;
}

export interface ClimateProjection {
  id: number;
  locationId: number;
  projectionYear: number;
  averageTemperature?: number;
  temperatureChange?: number;
  annualPrecipitation?: number;
  precipitationChange?: number;
  humidity?: number;
  humidityChange?: number;
  seaLevel?: number;
  seaLevelChange?: number;
  heatStressRisk?: number;
  droughtRisk?: number;
  floodingRisk?: number;
  monthlyTemperatures?: string;
  monthlyPrecipitation?: string;
  fetchedAt?: Date;
}

export interface MapMarker {
  latitude: number;
  longitude: number;
  name: string;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    borderWidth?: number;
    tension?: number;
  }[];
}

export interface RiskAssessment {
  heatStress: number;
  drought: number;
  flooding: number;
}

export interface ClimateComparison {
  locationA: ClimateLocation;
  locationB: ClimateLocation;
  projectionA: ClimateProjection;
  projectionB: ClimateProjection;
}
