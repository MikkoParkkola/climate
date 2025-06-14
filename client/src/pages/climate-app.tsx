import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

export default function ClimateApp() {
  const [location, setLocation] = useState("");
  const [year, setYear] = useState(2030);
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_NVIDIA_API_KEY || "");
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const handleSubmit = async () => {
    if (!location.trim()) {
      addLog("❌ Error: Location is required");
      return;
    }
    
    if (!apiKey.trim()) {
      addLog("❌ Error: NVIDIA API key is required");
      return;
    }

    if (year < 2024 || year > 2100) {
      addLog("❌ Error: Year must be between 2024 and 2100");
      return;
    }

    setIsLoading(true);
    addLog(`📍 Input validated - Location: ${location}, Year: ${year}`);
    addLog(`🔑 API Key provided (${apiKey.length} characters)`);
    
    try {
      addLog("🌐 Making API request to climate projection service...");
      
      const response = await fetch("/api/climate-projection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: location.trim(),
          year: year,
          apiKey: apiKey
        })
      });

      addLog(`📡 API Response Status: ${response.status} ${response.statusText}`);
      
      const data = await response.json();
      addLog("📊 API Response Data:");
      addLog(JSON.stringify(data, null, 2));

    } catch (error) {
      addLog(`❌ Request failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const setDecade = (decade: number) => {
    setYear(decade);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Climate Projection Tool</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Climate Projection Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* API Key Input */}
            <div className="space-y-2">
              <Label htmlFor="apiKey">NVIDIA API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter your NVIDIA API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              {apiKey && (
                <p className="text-xs text-gray-500">
                  API key loaded from environment (development only)
                </p>
              )}
            </div>

            {/* Location Input */}
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="Enter city name (e.g., New York, London, Tokyo)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            {/* Year Selection */}
            <div className="space-y-4">
              <Label>Target Year: {year}</Label>
              
              {/* Decade Buttons */}
              <div className="flex flex-wrap gap-2">
                {[2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100].map((decade) => (
                  <Button
                    key={decade}
                    variant={year === decade ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDecade(decade)}
                  >
                    {decade}
                  </Button>
                ))}
              </div>

              {/* Year Slider */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">Fine-tune year:</Label>
                <Slider
                  value={[year]}
                  onValueChange={(value) => setYear(value[0])}
                  min={2024}
                  max={2100}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Manual Year Input */}
              <div className="space-y-2">
                <Label htmlFor="yearInput" className="text-sm text-gray-600">Or type exact year:</Label>
                <Input
                  id="yearInput"
                  type="number"
                  min={2024}
                  max={2100}
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value) || 2030)}
                  className="w-32"
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              onClick={handleSubmit} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Getting Climate Projection..." : "Get Climate Projection"}
            </Button>
          </CardContent>
        </Card>

        {/* Logs Panel */}
        <Card>
          <CardHeader>
            <CardTitle>API Logs</CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setLogs([])}
              className="ml-auto"
            >
              Clear Logs
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea
              value={logs.join('\n')}
              readOnly
              className="h-96 font-mono text-sm"
              placeholder="API request and response logs will appear here..."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}