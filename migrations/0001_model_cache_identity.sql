ALTER TABLE climate_model_cache
  ADD COLUMN IF NOT EXISTS scenario text NOT NULL DEFAULT 'ssp245';

ALTER TABLE climate_model_cache
  ADD COLUMN IF NOT EXISTS cache_version text NOT NULL DEFAULT 'grounded-grid-i16-v2-raw-temp-headline:0dc3f9d188e4d757';

ALTER TABLE climate_model_cache
  ADD COLUMN IF NOT EXISTS source_registry_version text NOT NULL DEFAULT 'source-registry-v1';

DROP INDEX IF EXISTS cmc_coord_year_idx;

CREATE UNIQUE INDEX IF NOT EXISTS cmc_identity_idx
  ON climate_model_cache (lat_key, lng_key, year, scenario, cache_version);
