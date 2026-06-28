export const MODEL_CACHE_VERSION = "grounded-grid-i16-v3-hazard-habitability:0dc3f9d188e4d757";
export const SOURCE_REGISTRY_VERSION = "source-registry-v1";

type ModelCacheEnvelope = {
  __cache: {
    modelVersion: string;
    scenario: string;
    sourceRegistryVersion: string;
  };
  projection: unknown;
};

export function wrapModelProjectionForCache(projection: unknown, scenario: string): ModelCacheEnvelope {
  return {
    __cache: {
      modelVersion: MODEL_CACHE_VERSION,
      scenario,
      sourceRegistryVersion: SOURCE_REGISTRY_VERSION,
    },
    projection,
  };
}

export function unwrapModelProjectionFromCache(value: unknown, expectedScenario?: string): unknown | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const envelope = value as Partial<ModelCacheEnvelope>;
  if (envelope.__cache?.modelVersion !== MODEL_CACHE_VERSION) {
    return undefined;
  }
  if (envelope.__cache.sourceRegistryVersion !== SOURCE_REGISTRY_VERSION) {
    return undefined;
  }
  if (expectedScenario && envelope.__cache.scenario !== expectedScenario) {
    return undefined;
  }

  return envelope.projection;
}
