import {
  users, climateLocations, climateProjections, locationComparisons, climateModelCache,
  type User, type InsertUser,
  type ClimateLocation, type InsertClimateLocation,
  type ClimateProjection, type InsertClimateProjection,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, ilike, or, sql } from "drizzle-orm";
import {
  MODEL_CACHE_VERSION,
  SOURCE_REGISTRY_VERSION,
  unwrapModelProjectionFromCache,
  wrapModelProjectionForCache,
} from "./model-cache-version";

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

function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
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

  // Raw model-output cache, versioned inside the JSON payload.
  getCachedModelProjection(latKey: number, lngKey: number, year: number, scenario: string): Promise<unknown | undefined>;
  saveModelProjection(latKey: number, lngKey: number, year: number, scenario: string, projection: unknown): Promise<void>;
  purgeIncompatibleModelCache(): Promise<number>;

  createLocationComparison(userId: number, name: string, locationIds: number[], year: number): Promise<unknown>;
  getUserComparisons(userId: number): Promise<unknown[]>;
}

// ── Implementation ────────────────────────────────────────────────────────────
export class DatabaseStorage implements IStorage {
  private modelCacheSchemaReady: Promise<void> | undefined;

  private ensureModelCacheSchema(): Promise<void> {
    if (!this.modelCacheSchemaReady) {
      this.modelCacheSchemaReady = (async () => {
        await db.execute(sql`
          ALTER TABLE climate_model_cache
          ADD COLUMN IF NOT EXISTS scenario text NOT NULL DEFAULT 'ssp245'
        `);
        await db.execute(sql`
          ALTER TABLE climate_model_cache
          ADD COLUMN IF NOT EXISTS cache_version text NOT NULL DEFAULT ${sql.raw(sqlStringLiteral(MODEL_CACHE_VERSION))}
        `);
        await db.execute(sql`
          ALTER TABLE climate_model_cache
          ADD COLUMN IF NOT EXISTS source_registry_version text NOT NULL DEFAULT ${sql.raw(sqlStringLiteral(SOURCE_REGISTRY_VERSION))}
        `);
        await db.execute(sql`DROP INDEX IF EXISTS cmc_coord_year_idx`);
        await db.execute(sql`
          CREATE UNIQUE INDEX IF NOT EXISTS cmc_identity_idx
          ON climate_model_cache (lat_key, lng_key, year, scenario, cache_version)
        `);
      })();
    }
    return this.modelCacheSchemaReady;
  }

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

  // ── Raw model-output cache ─────────────────────────────────────────────────
  async getCachedModelProjection(latKey: number, lngKey: number, year: number, scenario: string): Promise<unknown | undefined> {
    await this.ensureModelCacheSchema();
    const [row] = await db
      .select()
      .from(climateModelCache)
      .where(
        and(
          eq(climateModelCache.latKey, latKey),
          eq(climateModelCache.lngKey, lngKey),
          eq(climateModelCache.year, year),
          eq(climateModelCache.scenario, scenario),
          eq(climateModelCache.cacheVersion, MODEL_CACHE_VERSION),
          eq(climateModelCache.sourceRegistryVersion, SOURCE_REGISTRY_VERSION),
        )
      )
      .limit(1);
    return row ? unwrapModelProjectionFromCache(safeJsonParse(row.projection), scenario) : undefined;
  }

  async saveModelProjection(latKey: number, lngKey: number, year: number, scenario: string, projection: unknown): Promise<void> {
    await this.ensureModelCacheSchema();
    // Overwrite on conflict so an old unversioned cbottle-era row cannot keep a
    // grounded projection from replacing it under the same rounded coordinate,
    // scenario, and cache version.
    const cachedProjection = JSON.stringify(wrapModelProjectionForCache(projection, scenario));
    await db
      .insert(climateModelCache)
      .values({
        latKey,
        lngKey,
        year,
        scenario,
        cacheVersion: MODEL_CACHE_VERSION,
        sourceRegistryVersion: SOURCE_REGISTRY_VERSION,
        projection: cachedProjection,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          climateModelCache.latKey,
          climateModelCache.lngKey,
          climateModelCache.year,
          climateModelCache.scenario,
          climateModelCache.cacheVersion,
        ],
        set: {
          sourceRegistryVersion: SOURCE_REGISTRY_VERSION,
          projection: cachedProjection,
          createdAt: new Date(),
        },
      });
  }

  async purgeIncompatibleModelCache(): Promise<number> {
    await this.ensureModelCacheSchema();
    const modelVersionNeedle = `%"modelVersion":"${MODEL_CACHE_VERSION}"%`;
    const sourceRegistryNeedle = `%"sourceRegistryVersion":"${SOURCE_REGISTRY_VERSION}"%`;
    const deleted = await db
      .delete(climateModelCache)
      .where(sql`
        ${climateModelCache.cacheVersion} <> ${MODEL_CACHE_VERSION}
        OR ${climateModelCache.sourceRegistryVersion} <> ${SOURCE_REGISTRY_VERSION}
        OR ${climateModelCache.projection} NOT LIKE ${modelVersionNeedle}
        OR ${climateModelCache.projection} NOT LIKE ${sourceRegistryNeedle}
      `)
      .returning({ id: climateModelCache.id });
    return deleted.length;
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
