import fs from "fs";
import path from "path";
import { SOURCE_REGISTRY_VERSION } from "./model-cache-version";

type SourceRegistry = {
  version: string;
  generatedAt: string;
  rows: Array<{
    sourceId: string;
    provider: string;
    displayPolicy: string;
    variables: string[];
  }>;
};

let cachedRegistry: SourceRegistry | undefined;

function sourceRegistryPath(): string {
  return path.resolve(import.meta.dirname, "..", "data", "source-registry.json");
}

export function loadSourceRegistry(): SourceRegistry {
  if (!cachedRegistry) {
    const registry = JSON.parse(fs.readFileSync(sourceRegistryPath(), "utf-8")) as SourceRegistry;
    if (registry.version !== SOURCE_REGISTRY_VERSION) {
      throw new Error(`source registry version mismatch: ${registry.version}`);
    }
    cachedRegistry = registry;
  }
  return cachedRegistry;
}

export function assertSourceIdsRegistered(sourceIds: string[]): void {
  const registry = loadSourceRegistry();
  const registered = new Set(registry.rows.map((row) => row.sourceId));
  const missing = sourceIds.filter((sourceId) => !registered.has(sourceId));
  if (missing.length > 0) {
    throw new Error(`unregistered source ids: ${missing.join(", ")}`);
  }
}
