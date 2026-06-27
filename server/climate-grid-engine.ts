export type ClimateGridEngine = "python" | "node";

export function getClimateGridEngine(): ClimateGridEngine {
  const requested = process.env.CLIMATE_GRID_ENGINE;
  if (requested === "node" || requested === "python") return requested;
  return "python";
}
