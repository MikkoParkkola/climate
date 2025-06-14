import { users, climateLocations, climateProjections, type User, type InsertUser, type ClimateLocation, type InsertClimateLocation, type ClimateProjection, type InsertClimateProjection } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Climate location methods
  getClimateLocation(id: number): Promise<ClimateLocation | undefined>;
  getClimateLocationByCoordinates(latitude: number, longitude: number): Promise<ClimateLocation | undefined>;
  createClimateLocation(location: InsertClimateLocation): Promise<ClimateLocation>;
  searchClimateLocations(query: string): Promise<ClimateLocation[]>;
  
  // Climate projection methods
  getClimateProjection(locationId: number, year: number): Promise<ClimateProjection | undefined>;
  createClimateProjection(projection: InsertClimateProjection): Promise<ClimateProjection>;
  getClimateProjectionsByLocation(locationId: number): Promise<ClimateProjection[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private climateLocations: Map<number, ClimateLocation>;
  private climateProjections: Map<string, ClimateProjection>;
  private currentUserId: number;
  private currentLocationId: number;
  private currentProjectionId: number;

  constructor() {
    this.users = new Map();
    this.climateLocations = new Map();
    this.climateProjections = new Map();
    this.currentUserId = 1;
    this.currentLocationId = 1;
    this.currentProjectionId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getClimateLocation(id: number): Promise<ClimateLocation | undefined> {
    return this.climateLocations.get(id);
  }

  async getClimateLocationByCoordinates(latitude: number, longitude: number): Promise<ClimateLocation | undefined> {
    return Array.from(this.climateLocations.values()).find(
      (location) => 
        Math.abs(location.latitude - latitude) < 0.001 && 
        Math.abs(location.longitude - longitude) < 0.001
    );
  }

  async createClimateLocation(insertLocation: InsertClimateLocation): Promise<ClimateLocation> {
    const id = this.currentLocationId++;
    const location: ClimateLocation = { 
      ...insertLocation, 
      id,
      createdAt: new Date()
    };
    this.climateLocations.set(id, location);
    return location;
  }

  async searchClimateLocations(query: string): Promise<ClimateLocation[]> {
    const searchTerm = query.toLowerCase();
    return Array.from(this.climateLocations.values()).filter(
      (location) => 
        location.name.toLowerCase().includes(searchTerm) ||
        location.country?.toLowerCase().includes(searchTerm) ||
        location.region?.toLowerCase().includes(searchTerm)
    );
  }

  async getClimateProjection(locationId: number, year: number): Promise<ClimateProjection | undefined> {
    const key = `${locationId}-${year}`;
    return this.climateProjections.get(key);
  }

  async createClimateProjection(insertProjection: InsertClimateProjection): Promise<ClimateProjection> {
    const id = this.currentProjectionId++;
    const projection: ClimateProjection = { 
      ...insertProjection, 
      id,
      fetchedAt: new Date()
    };
    const key = `${projection.locationId}-${projection.projectionYear}`;
    this.climateProjections.set(key, projection);
    return projection;
  }

  async getClimateProjectionsByLocation(locationId: number): Promise<ClimateProjection[]> {
    return Array.from(this.climateProjections.values()).filter(
      (projection) => projection.locationId === locationId
    );
  }
}

export const storage = new MemStorage();
