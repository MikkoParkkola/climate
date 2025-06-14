import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, ExternalLink } from "lucide-react";

interface ApiErrorDisplayProps {
  error: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export default function ApiErrorDisplay({ error, onRetry, isRetrying = false }: ApiErrorDisplayProps) {
  const isAuthError = error.includes("authentication") || error.includes("API key");
  const isRateLimit = error.includes("rate limit");
  const isEndpointError = error.includes("endpoint not found");

  const getErrorType = () => {
    if (isAuthError) return "Authentication Error";
    if (isRateLimit) return "Rate Limit Exceeded";
    if (isEndpointError) return "Service Unavailable";
    return "Climate Data Error";
  };

  const getErrorSolution = () => {
    if (isAuthError) {
      return "Please verify your NVIDIA API key is correct and has access to Earth-2 Climate modeling functions.";
    }
    if (isRateLimit) {
      return "API usage limit reached. Please wait a few minutes before trying again or consider upgrading your API plan.";
    }
    if (isEndpointError) {
      return "The NVIDIA Earth-2 Climate service is currently unavailable. Please try again later.";
    }
    return "There was an issue retrieving climate projection data. Please check your connection and try again.";
  };

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-red-800 flex items-center">
          <AlertCircle className="text-red-600 mr-2 h-5 w-5" />
          {getErrorType()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-red-700">
            {getErrorSolution()}
          </p>
          
          <div className="text-xs text-red-600 font-mono bg-red-100 p-2 rounded border">
            {error}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {onRetry && (
              <Button
                onClick={onRetry}
                disabled={isRetrying}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </>
                )}
              </Button>
            )}
            
            {isAuthError && (
              <Button
                variant="outline"
                onClick={() => window.open("https://developer.nvidia.com/", "_blank")}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Get NVIDIA API Key
              </Button>
            )}
          </div>

          <div className="bg-blue-50 p-3 rounded border border-blue-200">
            <h4 className="text-sm font-medium text-blue-800 mb-2">About Climate Data Sources</h4>
            <p className="text-xs text-blue-700">
              This application uses authentic climate projections from NVIDIA's Earth-2 Climate API, 
              which provides AI-powered climate modeling based on advanced atmospheric simulations. 
              When the service is available, you'll receive real climate projection data for your selected location.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}