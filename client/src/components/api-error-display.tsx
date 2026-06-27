import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

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
      return "This deployment uses the offline grounded climate model; external API keys are not required. Refresh and try again.";
    }
    if (isRateLimit) {
      return "Usage limit reached. Please wait a few minutes before trying again.";
    }
    if (isEndpointError) {
      return "The grounded climate service is currently unavailable. Please try again later.";
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
          </div>

          <div className="bg-blue-50 p-3 rounded border border-blue-200">
            <h4 className="text-sm font-medium text-blue-800 mb-2">About Climate Data Sources</h4>
            <p className="text-xs text-blue-700">
              This application serves grounded CMIP6/IPCC projections from the local climate grid.
              If the model cannot produce a value, the app should omit it rather than inventing a fallback.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
