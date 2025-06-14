import { pgTable, text, serial, integer, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
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
