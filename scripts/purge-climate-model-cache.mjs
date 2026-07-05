#!/usr/bin/env node
import pg from "pg";

const CONFIRMATION = "TRUNCATE_CLIMATE_MODEL_CACHE";
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

function usage() {
  return [
    "Usage:",
    "  npm run db:purge-model-cache:dry-run",
    "  FUPIT_CONFIRM_CACHE_PURGE=TRUNCATE_CLIMATE_MODEL_CACHE npm run db:purge-model-cache",
    "",
    "This truncates climate_model_cache only. It does not touch source artifacts, users, locations, or schema.",
  ].join("\n");
}

function localSslFor(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const host = parsed.hostname;
  return host === "localhost" || host === "127.0.0.1" ? false : { rejectUnauthorized: false };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(`DATABASE_URL is required.\n\n${usage()}`);
  }

  if (!dryRun && process.env.FUPIT_CONFIRM_CACHE_PURGE !== CONFIRMATION) {
    throw new Error(`Refusing destructive purge without FUPIT_CONFIRM_CACHE_PURGE=${CONFIRMATION}.\n\n${usage()}`);
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: localSslFor(databaseUrl),
  });

  try {
    const table = await pool.query("SELECT to_regclass('public.climate_model_cache') AS table_name");
    if (!table.rows[0]?.table_name) {
      throw new Error("public.climate_model_cache does not exist in this database.");
    }

    const before = await pool.query("SELECT count(*)::int AS count FROM climate_model_cache");
    const beforeCount = before.rows[0]?.count ?? 0;

    if (dryRun) {
      console.log(JSON.stringify({
        ok: true,
        dryRun: true,
        table: "public.climate_model_cache",
        rowsBefore: beforeCount,
        action: "would truncate climate_model_cache",
      }, null, 2));
      return;
    }

    await pool.query("TRUNCATE TABLE climate_model_cache");
    const after = await pool.query("SELECT count(*)::int AS count FROM climate_model_cache");
    const afterCount = after.rows[0]?.count ?? 0;
    if (afterCount !== 0) {
      throw new Error(`TRUNCATE completed but climate_model_cache still has ${afterCount} rows.`);
    }

    console.log(JSON.stringify({
      ok: true,
      dryRun: false,
      table: "public.climate_model_cache",
      rowsBefore: beforeCount,
      rowsAfter: afterCount,
      action: "truncated climate_model_cache",
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
