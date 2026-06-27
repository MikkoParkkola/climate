import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Eye, EyeOff, Save, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ApiKeyManagerProps {
  className?: string;
}

interface ApiKeyStatus {
  nvidiaApiKey: boolean;
  cbottleApiKey: boolean;
}

export default function ApiKeyManager({ className = "" }: ApiKeyManagerProps) {
  const [showNvidiaKey, setShowNvidiaKey] = useState(false);
  const [showSecondaryKey, setShowSecondaryKey] = useState(false);
  const [nvidiaKey, setNvidiaKey] = useState("");
  const [secondaryKey, setSecondaryKey] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: currentKeys, isLoading } = useQuery<ApiKeyStatus>({
    queryKey: ['/api/user/keys'],
  });

  const saveKeysMutation = useMutation({
    mutationFn: async (keys: { nvidiaApiKey?: string; cbottleApiKey?: string }) => {
      return await apiRequest("PUT", "/api/user/keys", keys);
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "External API keys are retired for grounded projections; saved values are ignored by the current model.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user/keys'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!nvidiaKey && !secondaryKey) {
      toast({
        title: "No Keys Provided",
        description: "Please enter at least one API key to save.",
        variant: "destructive",
      });
      return;
    }

    saveKeysMutation.mutate({
      nvidiaApiKey: nvidiaKey || undefined,
      cbottleApiKey: secondaryKey || undefined,
    });
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>API Key Management</CardTitle>
          <CardDescription>Loading your saved API keys...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Retired API Key Settings
        </CardTitle>
        <CardDescription>
          External model keys are no longer used for grounded projections
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            fupit now serves projections from the offline CMIP6/IPCC grid. This legacy panel remains for old
            saved settings only; new forecasts do not call external climate APIs.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nvidia-key">Retired external model key</Label>
            <div className="relative">
              <Input
                id="nvidia-key"
                type={showNvidiaKey ? "text" : "password"}
                placeholder={currentKeys?.nvidiaApiKey ? "Saved legacy key" : "Not used by grounded model"}
                value={nvidiaKey}
                onChange={(e) => setNvidiaKey(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowNvidiaKey(!showNvidiaKey)}
              >
                {showNvidiaKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              This key is ignored by the current grounded model.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cbottle-key">Retired secondary model key</Label>
            <div className="relative">
              <Input
                id="cbottle-key"
                type={showSecondaryKey ? "text" : "password"}
                placeholder={currentKeys?.cbottleApiKey ? "Saved legacy key" : "Not used by grounded model"}
                value={secondaryKey}
                onChange={(e) => setSecondaryKey(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowSecondaryKey(!showSecondaryKey)}
              >
                {showSecondaryKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              This key is ignored by the current grounded model.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4">
          <Button 
            onClick={handleSave} 
            disabled={saveKeysMutation.isPending}
            className="flex items-center gap-2"
          >
            {saveKeysMutation.isPending ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save API Keys
              </>
            )}
          </Button>
          
          {currentKeys?.nvidiaApiKey && (
            <div className="flex items-center gap-1 text-sm text-green-600">
              <Check className="h-4 w-4" />
              Legacy key saved
            </div>
          )}
          
          {currentKeys?.cbottleApiKey && (
            <div className="flex items-center gap-1 text-sm text-green-600">
              <Check className="h-4 w-4" />
              Legacy secondary key saved
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
