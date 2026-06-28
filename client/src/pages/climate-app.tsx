import ClimateLanding from "@/components/climate-landing";
import ClimateResultView from "@/components/climate-result-view";
import { useClimateApp } from "@/hooks/use-climate-app";

export default function ClimateApp() {
  const vm = useClimateApp();

  if (!vm.trajectory) {
    return (
      <ClimateLanding
        locationText={vm.locationText}
        setLocationText={vm.setLocationText}
        setSelectedLocation={vm.setSelectedLocation}
        suggestions={vm.suggestions}
        showSuggestions={vm.showSuggestions}
        setShowSuggestions={vm.setShowSuggestions}
        selectLocation={vm.selectLocation}
        scenario={vm.scenario}
        changeScenario={vm.changeScenario}
        isLoading={vm.isLoading}
        selectedScenario={vm.selectedScenario}
        generate={vm.generate}
        loadingStep={vm.loadingStep}
        error={vm.error}
      />
    );
  }

  return <ClimateResultView vm={vm} />;
}
