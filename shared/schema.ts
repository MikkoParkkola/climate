import { pgTable, text, serial, integer, boolean, real, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  nvidiaApiKey: text("nvidia_api_key"),
  cbottleApiKey: text("cbottle_api_key"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Session storage table for authentication
export const sessions = pgTable("sessions", {
  sid: text("sid").primaryKey(),
  sess: text("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// Location comparisons table
export const locationComparisons = pgTable("location_comparisons", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  locationIds: text("location_ids").notNull(), // JSON array of location IDs
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const climateLocations = pgTable("climate_locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  country: text("country"),
  region: text("region"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const climateProjections = pgTable("climate_projections", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").references(() => climateLocations.id),
  projectionYear: integer("projection_year").notNull(),
  averageTemperature: real("average_temperature"),
  temperatureChange: real("temperature_change"),
  annualPrecipitation: real("annual_precipitation"),
  precipitationChange: real("precipitation_change"),
  humidity: real("humidity"),
  humidityChange: real("humidity_change"),
  seaLevel: real("sea_level"),
  seaLevelChange: real("sea_level_change"),
  heatStressRisk: integer("heat_stress_risk"), // 0-100 scale
  droughtRisk: integer("drought_risk"), // 0-100 scale
  floodingRisk: integer("flooding_risk"), // 0-100 scale
  monthlyTemperatures: text("monthly_temperatures"), // JSON array
  monthlyPrecipitation: text("monthly_precipitation"), // JSON array
  // Enhanced habitability and environmental data
  habitabilityScore: integer("habitability_score"), // 0-100 scale
  habitabilityBreakdown: text("habitability_breakdown"), // JSON object
  elevationChange: real("elevation_change"), // meters
  coastalFloodingRisk: integer("coastal_flooding_risk"), // 0-100 scale
  extremeWeatherEvents: integer("extreme_weather_events"), // frequency per year
  biodiversityLoss: real("biodiversity_loss"), // percentage
  agriculturalViability: integer("agricultural_viability"), // 0-100 scale
  waterStressLevel: integer("water_stress_level"), // 0-100 scale
  airQualityIndex: integer("air_quality_index"), // 0-500 scale
  // Comparable location data
  comparableLocationName: text("comparable_location_name"),
  comparableLocationLat: real("comparable_location_lat"),
  comparableLocationLng: real("comparable_location_lng"),
  comparableLocationCountry: text("comparable_location_country"),
  climateSimilarityScore: real("climate_similarity_score"), // 0-1 scale
  fetchedAt: timestamp("fetched_at").defaultNow(),
});

// Lossless cache of raw climate-model output, keyed by a rounded coordinate
// grid + year. Lets repeat/near-identical requests reuse a previous model run
// instead of re-spawning the (slow) Python model. Stores the full projection
// JSON so no fields are lost vs. the flattened climate_projections table.
export const climateModelCache = pgTable(
  "climate_model_cache",
  {
    id: serial("id").primaryKey(),
    latKey: real("lat_key").notNull(),
    lngKey: real("lng_key").notNull(),
    year: integer("year").notNull(),
    projection: text("projection").notNull(), // full model output, JSON-encoded
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    coordYearIdx: uniqueIndex("cmc_coord_year_idx").on(t.latKey, t.lngKey, t.year),
  }),
);

// ── Grounded forecast grid (Phase 2/3) ──────────────────────────────────────
// The real, scientifically-grounded layer: CMIP6 ensemble change-factors vs the
// 1995-2014 baseline, per variable/scenario/decade, on a coarse grid. Stores the
// RAW ensemble delta + spread; the IPCC-calibrated value is derived at serve time
// by multiplying by k from climate_calibration. Distinct from the legacy
// climate_model_cache (JSON blobs) on purpose — different data, different truth.
export const climateGrid = pgTable(
  "climate_grid",
  {
    id: serial("id").primaryKey(),
    variable: text("variable").notNull(),   // temperature | precipitation | humidity
    scenario: text("scenario").notNull(),   // ssp119 | ssp126 | ssp245 | ssp370 | ssp585
    decade: integer("decade").notNull(),    // 2030..2100
    latKey: real("lat_key").notNull(),
    lngKey: real("lng_key").notNull(),
    deltaMean: real("delta_mean").notNull(),  // raw ensemble-mean change vs 1995-2014
    deltaStd: real("delta_std"),              // ensemble spread (uncertainty)
    nModels: integer("n_models"),             // models contributing (coverage varies)
    unit: text("unit").notNull(),             // "absolute" (°C) | "percent" (precip)
    source: text("source").notNull(),         // provenance, e.g. "CMIP6/ScenarioMIP + AR6"
    methodVersion: text("method_version").notNull(), // cache invalidation
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    gridKeyIdx: uniqueIndex("cg_key_idx").on(
      t.variable, t.scenario, t.decade, t.latKey, t.lngKey,
    ),
  }),
);

// Per-(variable, scenario, decade) "hot model" scaling factor: the raw CMIP6
// multi-model mean runs warmer than the IPCC AR6 assessed best estimate
// (Hausfather et al. 2022). Serve both numbers + the gap; default to calibrated.
// ~40 rows — kept out of climate_grid to avoid duplicating k across 400k cells.
export const climateCalibration = pgTable(
  "climate_calibration",
  {
    id: serial("id").primaryKey(),
    variable: text("variable").notNull(),
    scenario: text("scenario").notNull(),
    decade: integer("decade").notNull(),
    k: real("k").notNull(),                       // calibrated = raw * k
    rawGlobal: real("raw_global").notNull(),      // raw ensemble global-mean
    assessedGlobal: real("assessed_global").notNull(), // AR6 assessed global-mean
    source: text("source").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    calKeyIdx: uniqueIndex("cc_key_idx").on(t.variable, t.scenario, t.decade),
  }),
);

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertClimateLocationSchema = createInsertSchema(climateLocations).omit({
  id: true,
  createdAt: true,
});

export const insertClimateProjectionSchema = createInsertSchema(climateProjections).omit({
  id: true,
  fetchedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertClimateLocation = z.infer<typeof insertClimateLocationSchema>;
export type ClimateLocation = typeof climateLocations.$inferSelect;

export type InsertClimateProjection = z.infer<typeof insertClimateProjectionSchema>;
export type ClimateProjection = typeof climateProjections.$inferSelect;

export type ClimateModelCache = typeof climateModelCache.$inferSelect;

export type ClimateGrid = typeof climateGrid.$inferSelect;
export type ClimateCalibration = typeof climateCalibration.$inferSelect;
