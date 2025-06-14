import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertClimateLocationSchema, insertClimateProjectionSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Climate location routes
  app.get("/api/locations/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }
      
      const locations = await storage.searchClimateLocations(query);
      res.json(locations);
    } catch (error) {
      console.error("Error searching locations:", error);
      res.status(500).json({ message: "Failed to search locations" });
    }
  });

  app.post("/api/locations", async (req, res) => {
    try {
      const locationData = insertClimateLocationSchema.parse(req.body);
      
      // Check if location already exists
      const existing = await storage.getClimateLocationByCoordinates(
        locationData.latitude, 
        locationData.longitude
      );
      
      if (existing) {
        return res.json(existing);
      }
      
      const location = await storage.createClimateLocation(locationData);
      res.json(location);
    } catch (error) {
      console.error("Error creating location:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid location data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create location" });
    }
  });

  // Climate projection routes
  app.get("/api/projections/:locationId/:year", async (req, res) => {
    try {
      const locationId = parseInt(req.params.locationId);
      const year = parseInt(req.params.year);
      
      if (isNaN(locationId) || isNaN(year)) {
        return res.status(400).json({ message: "Invalid location ID or year" });
      }
      
      let projection = await storage.getClimateProjection(locationId, year);
      
      if (!projection) {
        // Fetch from NVIDIA Earth-2 API
        projection = await fetchClimateProjectionFromAPI(locationId, year);
        if (projection) {
          await storage.createClimateProjection(projection);
        }
      }
      
      if (!projection) {
        return res.status(404).json({ message: "Climate projection not found" });
      }
      
      res.json(projection);
    } catch (error) {
      console.error("Error fetching climate projection:", error);
      res.status(500).json({ message: "Failed to fetch climate projection" });
    }
  });

  app.get("/api/projections/:locationId", async (req, res) => {
    try {
      const locationId = parseInt(req.params.locationId);
      
      if (isNaN(locationId)) {
        return res.status(400).json({ message: "Invalid location ID" });
      }
      
      const projections = await storage.getClimateProjectionsByLocation(locationId);
      res.json(projections);
    } catch (error) {
      console.error("Error fetching projections:", error);
      res.status(500).json({ message: "Failed to fetch projections" });
    }
  });

  // Export data routes
  app.get("/api/export/csv/:locationId/:year", async (req, res) => {
    try {
      const locationId = parseInt(req.params.locationId);
      const year = parseInt(req.params.year);
      
      const location = await storage.getClimateLocation(locationId);
      const projection = await storage.getClimateProjection(locationId, year);
      
      if (!location || !projection) {
        return res.status(404).json({ message: "Data not found" });
      }
      
      const csvData = generateCSV(location, projection);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="climate-projection-${location.name}-${year}.csv"`);
      res.send(csvData);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ message: "Failed to export CSV" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function fetchClimateProjectionFromAPI(locationId: number, year: number) {
  try {
    const location = await storage.getClimateLocation(locationId);
    if (!location) {
      throw new Error("Location not found");
    }

    const apiKey = process.env.NVIDIA_API_KEY || process.env.NVIDIA_EARTH2_API_KEY || process.env.CLIMATE_API_KEY;
    if (!apiKey) {
      throw new Error("NVIDIA API key not configured");
    }

    // Call NVIDIA Earth-2 Climate API
    const response = await fetch(`https://api.nvidia.com/earth2/climate/projection`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        latitude: location.latitude,
        longitude: location.longitude,
        projection_year: year,
        variables: ['temperature', 'precipitation', 'humidity', 'sea_level'],
        resolution: 'monthly'
      })
    });

    if (!response.ok) {
      throw new Error(`NVIDIA API error: ${response.status} ${response.statusText}`);
    }

    const apiData = await response.json();
    
    // Transform API response to our schema format
    const projection = {
      locationId,
      projectionYear: year,
      averageTemperature: apiData.temperature?.annual_average,
      temperatureChange: apiData.temperature?.change_from_baseline,
      annualPrecipitation: apiData.precipitation?.annual_total,
      precipitationChange: apiData.precipitation?.change_from_baseline,
      humidity: apiData.humidity?.annual_average,
      humidityChange: apiData.humidity?.change_from_baseline,
      seaLevel: apiData.sea_level?.value,
      seaLevelChange: apiData.sea_level?.change_from_baseline,
      heatStressRisk: calculateRiskScore(apiData.temperature?.extreme_heat_days || 0),
      droughtRisk: calculateRiskScore(apiData.precipitation?.drought_index || 0),
      floodingRisk: calculateRiskScore(apiData.sea_level?.flood_risk || 0),
      monthlyTemperatures: JSON.stringify(apiData.temperature?.monthly || []),
      monthlyPrecipitation: JSON.stringify(apiData.precipitation?.monthly || []),
      // Enhanced habitability and environmental data
      habitabilityScore: calculateHabitabilityScore(apiData),
      elevationChange: apiData.elevation?.change_from_baseline || 0,
      coastalFloodingRisk: calculateRiskScore(apiData.coastal?.flood_risk || 0),
      extremeWeatherEvents: apiData.extreme_weather?.frequency || 0,
      biodiversityLoss: apiData.biodiversity?.loss_percentage || 0,
      agriculturalViability: calculateRiskScore(100 - (apiData.agriculture?.stress_level || 0)),
      waterStressLevel: calculateRiskScore(apiData.water?.stress_level || 0),
      airQualityIndex: apiData.air_quality?.index || 50,
      // Comparable location data (to be calculated)
      comparableLocationName: null,
      comparableLocationLat: null,
      comparableLocationLng: null,
      comparableLocationCountry: null,
      climateSimilarityScore: null,
    };

    return projection;
  } catch (error) {
    console.error("Error fetching from NVIDIA API:", error);
    return null;
  }
}

function calculateRiskScore(value: number): number {
  // Convert various risk indicators to 0-100 scale
  return Math.min(100, Math.max(0, Math.round(value * 100)));
}

function calculateHabitabilityScore(apiData: any): number {
  // Calculate overall habitability based on multiple factors
  const tempScore = Math.max(0, 100 - Math.abs((apiData.temperature?.annual_average || 20) - 20) * 5);
  const precipScore = Math.min(100, Math.max(0, (apiData.precipitation?.annual_total || 800) / 10));
  const riskScore = 100 - Math.max(
    apiData.temperature?.extreme_heat_days || 0,
    apiData.precipitation?.drought_index || 0,
    apiData.sea_level?.flood_risk || 0
  );
  
  return Math.round((tempScore + precipScore + riskScore) / 3);
}

function generateCSV(location: any, projection: any): string {
  const headers = [
    'Location',
    'Latitude',
    'Longitude',
    'Projection Year',
    'Average Temperature (°C)',
    'Temperature Change (°C)',
    'Annual Precipitation (mm)',
    'Precipitation Change (mm)',
    'Humidity (%)',
    'Humidity Change (%)',
    'Sea Level (m)',
    'Sea Level Change (m)',
    'Heat Stress Risk (0-100)',
    'Drought Risk (0-100)',
    'Flooding Risk (0-100)',
  ];

  const row = [
    location.name,
    location.latitude,
    location.longitude,
    projection.projectionYear,
    projection.averageTemperature,
    projection.temperatureChange,
    projection.annualPrecipitation,
    projection.precipitationChange,
    projection.humidity,
    projection.humidityChange,
    projection.seaLevel,
    projection.seaLevelChange,
    projection.heatStressRisk,
    projection.droughtRisk,
    projection.floodingRisk,
  ];

  return [headers.join(','), row.join(',')].join('\n');
}
