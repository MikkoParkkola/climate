import {
  users, climateLocations, climateProjections, locationComparisons,
  type User, type InsertUser,
  type ClimateLocation, type InsertClimateLocation,
  type ClimateProjection, type InsertClimateProjection,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, ilike, or } from "drizzle-orm";

// ── Safe JSON parsing ────────────────────────────────────────────────────────
function safeJsonParse<T = unknown>(val: string | null | undefined): T | undefined {
  if (!val) return undefined;
  try {
    return JSON.parse(val) as T;
  } catch {
    return undefined;
  }
}

function deserializeProjection(projection: ClimateProjection): ClimateProjection {
  return {
    ...projection,
    habitabilityBreakdown: safeJsonParse(projection.habitabilityBreakdown as unknown as string) as any,
    monthlyTemperatures:   safeJsonParse(projection.monthlyTemperatures   as unknown as string) as any,
    monthlyPrecipitation:  safeJsonParse(projection.monthlyPrecipitation  as unknown as string) as any,
  };
}

// ── Interface ────────────────────────────────────────────────────────────────
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserApiKeys(userId: number, nvidiaApiKey?: string, cbottleApiKey?: string): Promise<User>;

  getClimateLocation(id: number): Promise<ClimateLocation | undefined>;
  getClimateLocationByCoordinates(latitude: number, longitude: number): Promise<ClimateLocation | undefined>;
  createClimateLocation(location: InsertClimateLocation): Promise<ClimateLocation>;
  searchClimateLocations(query: string): Promise<ClimateLocation[]>;

  getClimateProjection(locationId: number, year: number): Promise<ClimateProjection | undefined>;
  createClimateProjection(projection: InsertClimateProjection): Promise<ClimateProjection>;
  getClimateProjectionsByLocation(locationId: number): Promise<ClimateProjection[]>;

  createLocationComparison(userId: number, name: string, locationIds: number[], year: number): Promise<unknown>;
  getUserComparisons(userId: number): Promise<unknown[]>;
}

// ── Implementation ────────────────────────────────────────────────────────────
export class DatabaseStorage implements IStorage {

  // ── Users ────────────────────────────────────────────────────────────────
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, nvidiaApiKey: null, cbottleApiKey: null, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return user;
  }

  async updateUserApiKeys(userId: number, nvidiaApiKey?: string, cbottleApiKey?: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ nvidiaApiKey, cbottleApiKey, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // ── Locations ────────────────────────────────────────────────────────────
  async getClimateLocation(id: number): Promise<ClimateLocation | undefined> {
    const [location] = await db.select().from(climateLocations).where(eq(climateLocations.id, id));
    return location || undefined;
  }

  /**
   * Finds a location within ±0.01° using a SQL range query rather than a
   * full-table scan + in-memory loop.
   */
  async getClimateLocationByCoordinates(latitude: number, longitude: number): Promise<ClimateLocation | undefined> {
    const tol = 0.01;
    const [location] = await db
      .select()
      .from(climateLocations)
      .where(
        and(
          gte(climateLocations.latitude,  latitude  - tol),
          lte(climateLocations.latitude,  latitude  + tol),
          gte(climateLocations.longitude, longitude - tol),
          lte(climateLocations.longitude, longitude + tol),
        )
      )
      .limit(1);
    return location || undefined;
  }

  async createClimateLocation(insertLocation: InsertClimateLocation): Promise<ClimateLocation> {
    const [location] = await db
      .insert(climateLocations)
      .values({ ...insertLocation, country: insertLocation.country || null, region: insertLocation.region || null, createdAt: new Date() })
      .returning();
    return location;
  }

  /**
   * Searches locations using a SQL ILIKE query instead of fetching every row
   * and filtering in JavaScript.
   */
  async searchClimateLocations(query: string): Promise<ClimateLocation[]> {
    const term = `%${query}%`;
    return db
      .select()
      .from(climateLocations)
      .where(
        or(
          ilike(climateLocations.name,    term),
          ilike(climateLocations.country, term),
          ilike(climateLocations.region,  term),
        )
      )
      .limit(10);
  }

  // ── Projections ──────────────────────────────────────────────────────────
  async getClimateProjection(locationId: number, year: number): Promise<ClimateProjection | undefined> {
    const [projection] = await db
      .select()
      .from(climateProjections)
      .where(
        and(
          eq(climateProjections.locationId,     locationId),
          eq(climateProjections.projectionYear, year),
        )
      );
    return projection ? deserializeProjection(projection) : undefined;
  }

  async createClimateProjection(insertProjection: InsertClimateProjection): Promise<ClimateProjection> {
    const [projection] = await db
      .insert(climateProjections)
      .values({ ...insertProjection, fetchedAt: new Date() })
      .returning();
    return projection;
  }

  async getClimateProjectionsByLocation(locationId: number): Promise<ClimateProjection[]> {
    const projections = await db
      .select()
      .from(climateProjections)
      .where(eq(climateProjections.locationId, locationId));
    return projections
      .sort((a, b) => a.projectionYear - b.projectionYear)
      .map(deserializeProjection);
  }

  // ── Comparisons ──────────────────────────────────────────────────────────
  async createLocationComparison(userId: number, name: string, locationIds: number[], year: number) {
    const [comparison] = await db
      .insert(locationComparisons)
      .values({ userId, name, locationIds: JSON.stringify(locationIds), year, createdAt: new Date() })
      .returning();
    return comparison;
  }

  async getUserComparisons(userId: number) {
    return db.select().from(locationComparisons).where(eq(locationComparisons.userId, userId));
  }
}

export const storage = new DatabaseStorage();
