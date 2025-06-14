import type { Express } from "express";
import { createServer, type Server } from "http";

export async function registerRoutes(app: Express): Promise<Server> {
  // Simple climate projection endpoint
  app.post('/api/climate-projection', async (req, res) => {
    try {
      const { location, year, apiKey } = req.body;
      
      console.log('Climate projection request:', { location, year, apiKeyProvided: !!apiKey });
      
      // Validate inputs
      if (!location || !year || !apiKey) {
        return res.status(400).json({ 
          error: 'Missing required fields: location, year, and apiKey are required' 
        });
      }
      
      if (year < 2024 || year > 2100) {
        return res.status(400).json({ 
          error: 'Year must be between 2024 and 2100' 
        });
      }
      
      // Call Climate in a Bottle API
      console.log('Making request to NVIDIA Climate in a Bottle API...');
      
      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: "meta/llama-3.1-405b-instruct",
          messages: [{
            role: "user",
            content: `Generate climate projection for ${location} in year ${year}. Provide temperature, precipitation, and risk data as JSON.`
          }],
          temperature: 0.1,
          max_tokens: 1000
        })
      });
      
      const apiResponse = await response.json();
      
      console.log('NVIDIA API response status:', response.status);
      console.log('NVIDIA API response:', JSON.stringify(apiResponse, null, 2));
      
      if (!response.ok) {
        return res.status(response.status).json({
          error: 'NVIDIA API error',
          details: apiResponse
        });
      }
      
      res.json({
        success: true,
        input: { location, year },
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