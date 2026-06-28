import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

export class DatabaseUnavailableError extends Error {
  statusCode = 503;

  constructor() {
    super("DATABASE_URL is not set; database-backed routes are unavailable.");
    this.name = "DatabaseUnavailableError";
  }
}

const { Pool } = pg;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

const unavailableDb = new Proxy(
  {},
  {
    get(_target, property) {
      if (property === "then") return undefined;
      throw new DatabaseUnavailableError();
    },
  },
) as ReturnType<typeof drizzle>;

const databaseUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : undefined;
const isLocalDatabase = databaseUrl?.hostname === "localhost" || databaseUrl?.hostname === "127.0.0.1";

export const pool = databaseUrl
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
    })
  : undefined;

export const db = pool ? drizzle(pool, { schema }) : unavailableDb;
