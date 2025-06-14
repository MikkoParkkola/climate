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

export default function ApiKeyManager({ className = "" }: ApiKeyManagerProps) {
  const [showNvidiaKey, setShowNvidiaKey] = useState(false);
  const [showCBottleKey, setShowCBottleKey] = useState(false);
  const [nvidiaKey, setNvidiaKey] = useState("");
  const [cbottleKey, setCBottleKey] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: currentKeys, isLoading } = useQuery({
    queryKey: ['/api/user/keys'],
  });

  const saveKeysMutation = useMutation({
    mutationFn: async (keys: { nvidiaApiKey?: string; cbottleApiKey?: string }) => {
      return await apiRequest('/api/user/keys', {
        method: 'PUT',
        body: JSON.stringify(keys),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      toast({
        title: "API Keys Saved",
        description: "Your API keys have been securely saved and will be used for climate projections.",
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
    if (!nvidiaKey && !cbottleKey) {
      toast({
        title: "No Keys Provided",
        description: "Please enter at least one API key to save.",
        variant: "destructive",
      });
      return;
    }

    saveKeysMutation.mutate({
      nvidiaApiKey: nvidiaKey || undefined,
      cbottleApiKey: cbottleKey || undefined,
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
          API Key Management
        </CardTitle>
        <CardDescription>
          Securely manage your climate API keys for enhanced projections
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your API keys are encrypted and stored securely. They enable access to advanced climate models 
            including NVIDIA Earth-2 Studio and CBottle for authentic climate projections.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nvidia-key">NVIDIA Earth-2 Studio API Key</Label>
            <div className="relative">
              <Input
                id="nvidia-key"
                type={showNvidiaKey ? "text" : "password"}
                placeholder={currentKeys?.nvidiaApiKey ? "••••••••••••••••" : "Enter your NVIDIA API key"}
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
              Get your key from NVIDIA's Earth-2 Studio platform
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cbottle-key">CBottle Climate API Key</Label>
            <div className="relative">
              <Input
                id="cbottle-key"
                type={showCBottleKey ? "text" : "password"}
                placeholder={currentKeys?.cbottleApiKey ? "••••••••••••••••" : "Enter your CBottle API key"}
                value={cbottleKey}
                onChange={(e) => setCBottleKey(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowCBottleKey(!showCBottleKey)}
              >
                {showCBottleKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Get your key from CBottle's climate modeling service
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
              NVIDIA key saved
            </div>
          )}
          
          {currentKeys?.cbottleApiKey && (
            <div className="flex items-center gap-1 text-sm text-green-600">
              <Check className="h-4 w-4" />
              CBottle key saved
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}