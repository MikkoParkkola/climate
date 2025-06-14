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
