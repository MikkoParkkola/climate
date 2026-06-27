import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ClimateApp from "@/pages/climate-app";
import ClimateComparison from "@/pages/climate-comparison";
import Methodology from "@/pages/methodology";
import DataQualityPage from "@/pages/data-quality";
import NotFound from "@/pages/not-found";
import PreviewBanner from "@/components/preview-banner";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ClimateApp} />
      <Route path="/comparison" component={() => <ClimateComparison onBack={() => window.location.href = '/'} />} />
      <Route path="/methodology" component={Methodology} />
      <Route path="/data-quality" component={DataQualityPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <PreviewBanner />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
