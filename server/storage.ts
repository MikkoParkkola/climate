import { users, climateLocations, climateProjections, locationComparisons, type User, type InsertUser, type ClimateLocation, type InsertClimateLocation, type ClimateProjection, type InsertClimateProjection } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserApiKeys(userId: number, nvidiaApiKey?: string, cbottleApiKey?: string): Promise<User>;
  
  // Climate location methods
  getClimateLocation(id: number): Promise<ClimateLocation | undefined>;
  getClimateLocationByCoordinates(latitude: number, longitude: number): Promise<ClimateLocation | undefined>;
  createClimateLocation(location: InsertClimateLocation): Promise<ClimateLocation>;
  searchClimateLocations(query: string): Promise<ClimateLocation[]>;
  
  // Climate projection methods
  getClimateProjection(locationId: number, year: number): Promise<ClimateProjection | undefined>;
  createClimateProjection(projection: InsertClimateProjection): Promise<ClimateProjection>;
  getClimateProjectionsByLocation(locationId: number): Promise<ClimateProjection[]>;
  
  // Comparison methods
  createLocationComparison(userId: number, name: string, locationIds: number[], year: number): Promise<any>;
  getUserComparisons(userId: number): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
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
      .values({
        ...insertUser,
        nvidiaApiKey: null,
        cbottleApiKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return user;
  }

  async updateUserApiKeys(userId: number, nvidiaApiKey?: string, cbottleApiKey?: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        nvidiaApiKey,
        cbottleApiKey,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getClimateLocation(id: number): Promise<ClimateLocation | undefined> {
    const [location] = await db.select().from(climateLocations).where(eq(climateLocations.id, id));
    return location || undefined;
  }

  async getClimateLocationByCoordinates(latitude: number, longitude: number): Promise<ClimateLocation | undefined> {
    const tolerance = 0.01;
    const locations = await db.select().from(climateLocations);
    
    for (const location of locations) {
      if (Math.abs(location.latitude - latitude) < tolerance && Math.abs(location.longitude - longitude) < tolerance) {
        return location;
      }
    }
    return undefined;
  }

  async createClimateLocation(insertLocation: InsertClimateLocation): Promise<ClimateLocation> {
    const [location] = await db
      .insert(climateLocations)
      .values({
        ...insertLocation,
        country: insertLocation.country || null,
        region: insertLocation.region || null,
        createdAt: new Date(),
      })
      .returning();
    return location;
  }

  async searchClimateLocations(query: string): Promise<ClimateLocation[]> {
    const locations = await db.select().from(climateLocations);
    const searchTerm = query.toLowerCase();
    
    return locations
      .filter(location => 
        location.name.toLowerCase().includes(searchTerm) ||
        (location.country && location.country.toLowerCase().includes(searchTerm)) ||
        (location.region && location.region.toLowerCase().includes(searchTerm))
      )
      .slice(0, 10);
  }

  async getClimateProjection(locationId: number, year: number): Promise<ClimateProjection | undefined> {
    const [projection] = await db
      .select()
      .from(climateProjections)
      .where(and(
        eq(climateProjections.locationId, locationId),
        eq(climateProjections.projectionYear, year)
      ));
    return projection || undefined;
  }

  async createClimateProjection(insertProjection: InsertClimateProjection): Promise<ClimateProjection> {
    const [projection] = await db
      .insert(climateProjections)
      .values({
        ...insertProjection,
        fetchedAt: new Date(),
      })
      .returning();
    return projection;
  }

  async getClimateProjectionsByLocation(locationId: number): Promise<ClimateProjection[]> {
    const projections = await db
      .select()
      .from(climateProjections)
      .where(eq(climateProjections.locationId, locationId));
    
    return projections.sort((a, b) => a.projectionYear - b.projectionYear);
  }

  async createLocationComparison(userId: number, name: string, locationIds: number[], year: number) {
    const [comparison] = await db
      .insert(locationComparisons)
      .values({
        userId,
        name,
        locationIds: JSON.stringify(locationIds),
        year,
        createdAt: new Date(),
      })
      .returning();
    return comparison;
  }

  async getUserComparisons(userId: number) {
    return await db
      .select()
      .from(locationComparisons)
      .where(eq(locationComparisons.userId, userId));
  }
}

export const storage = new DatabaseStorage();