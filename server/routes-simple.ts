import type { Express } from "express";
import { createServer, type Server } from "http";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get API key for testing
  app.get('/api/config', (req, res) => {
    res.json({
      nvidiaApiKey: process.env.NVIDIA_API_KEY || ''
    });
  });

  // Location search endpoint
  app.get('/api/locations/search', async (req, res) => {
    const query = req.query.q as string;
    if (!query || query.length < 2) {
      return res.json([]);
    }

    try {
      // Use OpenStreetMap Nominatim API for location search
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=10&addressdetails=1`, {
        headers: {
          'User-Agent': 'ClimateProjectionApp/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      const locations = data.map((item: any) => ({
        name: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        country: item.address?.country || '',
        city: item.address?.city || item.address?.town || item.address?.village || '',
        state: item.address?.state || ''
      }));

      res.json(locations);
    } catch (error) {
      console.error('Location search error:', error);
      res.status(500).json({ error: 'Location search failed' });
    }
  });

  // Simple climate projection endpoint
  app.post('/api/climate-projection', async (req, res) => {
    try {
      const { location, coordinates, year, apiKey } = req.body;
      
      console.log('Climate projection request:', { 
        location, 
        coordinates, 
        year, 
        apiKeyProvided: !!apiKey 
      });
      
      // Validate inputs
      if (!location || !coordinates || !year || !apiKey) {
        return res.status(400).json({ 
          error: 'Missing required fields: location, coordinates, year, and apiKey are required' 
        });
      }
      
      if (!coordinates.lat || !coordinates.lng) {
        return res.status(400).json({ 
          error: 'Invalid coordinates: lat and lng are required' 
        });
      }
      
      if (year < 2024 || year > 2100) {
        return res.status(400).json({ 
          error: 'Year must be between 2024 and 2100' 
        });
      }
      
      // Call Climate in a Bottle API
      console.log('Making request to NVIDIA Climate in a Bottle API...');
      
      const response = await fetch("https://integrate.api.nvidia.com/v1/cbottle", {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'ClimateProjectionApp/1.0'
        },
        body: JSON.stringify({
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          year: year,
          location: location,
          metrics: ["temperature", "precipitation", "extreme_weather", "habitability"]
        })
      });
      
      console.log('NVIDIA API response status:', response.status);
      console.log('NVIDIA API response headers:', Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log('NVIDIA API raw response:', responseText);
      
      if (!response.ok) {
        return res.status(response.status).json({
          error: 'NVIDIA API error',
          status: response.status,
          statusText: response.statusText,
          rawResponse: responseText
        });
      }
      
      let apiResponse;
      try {
        apiResponse = JSON.parse(responseText);
      } catch (parseError) {
        return res.status(500).json({
          error: 'Invalid JSON response from NVIDIA API',
          rawResponse: responseText,
          parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error'
        });
      }
      
      res.json({
        success: true,
        input: { location, coordinates, year },
        apiResponse: apiResponse,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Climate projection error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}