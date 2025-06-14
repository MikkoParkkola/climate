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
      
      // Run local CBottle implementation
      console.log('Running local CBottle climate model...');
      
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      try {
        const command = `python cbottle_runner.py ${coordinates.lat} ${coordinates.lng} ${year} "${apiKey}"`;
        console.log('Executing CBottle command:', command);
        
        const { stdout, stderr } = await execAsync(command);
        
        if (stderr) {
          console.log('CBottle stderr:', stderr);
        }
        
        console.log('CBottle stdout length:', stdout.length);
        
        const climateData = JSON.parse(stdout);
        
        if (climateData.error) {
          console.error('CBottle error:', climateData.error);
          return res.status(500).json({
            error: 'CBottle processing error',
            details: climateData.error,
            traceback: climateData.traceback
          });
        }

        console.log('CBottle climate projection generated successfully');
        console.log('Temperature range:', climateData.temperature.min, 'to', climateData.temperature.max, '°C');
        console.log('Annual precipitation:', climateData.precipitation.annual_total, 'mm');
        console.log('Habitability score:', climateData.habitability.score);

        res.json({
          success: true,
          input: { location, coordinates, year },
          data: climateData,
          timestamp: new Date().toISOString(),
          model: 'CBottle Local Implementation'
        });

      } catch (execError) {
        console.error('CBottle execution error:', execError);
        return res.status(500).json({
          error: 'CBottle execution failed',
          message: execError instanceof Error ? execError.message : 'Unknown execution error',
          details: 'Local CBottle runner encountered an error'
        });
      }
      
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