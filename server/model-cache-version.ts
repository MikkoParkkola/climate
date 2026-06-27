export const MODEL_CACHE_VERSION = "grounded-grid-i16-v1:0dc3f9d188e4d757";

type ModelCacheEnvelope = {
  __cache: {
    modelVersion: string;
  };
  projection: unknown;
};

export function wrapModelProjectionForCache(projection: unknown): ModelCacheEnvelope {
  return {
    __cache: {
      modelVersion: MODEL_CACHE_VERSION,
    },
    projection,
  };
}

export function unwrapModelProjectionFromCache(value: unknown): unknown | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const envelope = value as Partial<ModelCacheEnvelope>;
  if (envelope.__cache?.modelVersion !== MODEL_CACHE_VERSION) {
    return undefined;
  }

  return envelope.projection;
}
