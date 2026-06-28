import fs from "fs";
import path from "path";
import { z } from "zod";
import { MODEL_CACHE_VERSION, SOURCE_REGISTRY_VERSION } from "./model-cache-version";
import { assertSourceIdsRegistered } from "./source-registry";

const CLIMATE_SCENARIOS = ["ssp126", "ssp245", "ssp370", "ssp585"] as const;
const RANKING_DIRECTIONS = ["highest", "lowest"] as const;

export const rankingQuerySchema = z.object({
  year: z.coerce.number().int().min(2024).max(2100).default(2050),
  scenario: z.enum(CLIMATE_SCENARIOS).default("ssp245"),
  catalog: z.string().min(1).max(80).default("curated_cities"),
  metric: z.string().min(1).max(80).default("habitability_score"),
  direction: z.enum(RANKING_DIRECTIONS).default("highest"),
  limit: z.coerce.number().int().min(1).max(10).default(10),
});

type RankingQuery = z.infer<typeof rankingQuerySchema>;

type RankingRow = {
  rank: number;
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  population?: number;
  populationField?: string;
  inclusionReason?: string;
  value: number;
  unit: string;
  uncertainty?: { low?: number | null; high?: number | null };
  sourceReceipt: string[];
};

type RankingEntry = {
  methodVersion: string;
  sourceRegistryVersion: string;
  catalog: string;
  catalogSize: number;
  scenario: string;
  year: number;
  metric: string;
  label: string;
  direction: "highest" | "lowest";
  unit: string;
  rows: RankingRow[];
  exclusions: string[];
  caveats: string[];
  sourceIds: string[];
};

type RankingArtifact = {
  methodVersion: string;
  sourceRegistryVersion: string;
  generatedAt: string;
  catalog: string;
  catalogLabel?: string;
  catalogSourceIds?: string[];
  entries: RankingEntry[];
};

let cachedArtifacts: RankingArtifact[] | undefined;

function rankingPaths(): string[] {
  return [
    "rankings.curated-cities.json",
    "rankings.natural-earth-populated-places.json",
  ].map((file) => path.resolve(import.meta.dirname, "..", "data", file));
}

function loadRankingArtifacts(): RankingArtifact[] {
  if (!cachedArtifacts) {
    cachedArtifacts = rankingPaths().map((artifactPath) => {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8")) as RankingArtifact;
      if (artifact.methodVersion !== MODEL_CACHE_VERSION) {
        throw new Error(`ranking method version mismatch: ${artifact.methodVersion}`);
      }
      if (artifact.sourceRegistryVersion !== SOURCE_REGISTRY_VERSION) {
        throw new Error(`ranking source registry mismatch: ${artifact.sourceRegistryVersion}`);
      }
      for (const entry of artifact.entries) {
        assertSourceIdsRegistered(entry.sourceIds);
      }
      return artifact;
    });
  }
  return cachedArtifacts;
}

export function getRanking(query: RankingQuery): RankingEntry | undefined {
  const entry = loadRankingArtifacts()
    .flatMap((artifact) => artifact.entries)
    .find((candidate) =>
      candidate.catalog === query.catalog &&
      candidate.scenario === query.scenario &&
      candidate.year === query.year &&
      candidate.metric === query.metric &&
      candidate.direction === query.direction
    );
  if (!entry) return undefined;
  return {
    ...entry,
    rows: entry.rows.slice(0, query.limit),
  };
}
