/**
 * Matches Turtle curator names to existing DB curators.
 * Uses the curator field from the Turtle API when available,
 * falls back to vault name extraction for vaults without curator data.
 */

import { prisma } from "@/lib/db";
import { extractCuratorFromVaultName } from "@/lib/utils/extract-curator-name";
import type { TurtleCurator } from "./types";

/**
 * Maps Turtle curator names to canonical DB names.
 * Turtle API name (lowercase) → existing DB curator name.
 */
const CURATOR_NAME_ALIASES: Record<string, string> = {
  "steakhouse": "Steakhouse Financial",
  "yearn": "Yearn Finance",
  "re7 labs": "Re7 Labs",
  "re7": "Re7 Labs",
  "re7 capital": "Re7 Labs",
  "gauntlet": "Gauntlet",
  "hyperithm": "Hyperithm",
  "mev capital": "MEV Capital",
  "block analitica": "Block Analitica",
  "idle": "Idle Finance",
  "idle finance": "Idle Finance",
  "morpho association": "Morpho",
  "instadapp": "Instadapp",
  "avant": "Avantgarde Finance",
  "avantgarde": "Avantgarde Finance",
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Find or create a curator for a Turtle opportunity.
 * Uses the API curator field when available, falls back to vault name extraction.
 */
export async function findOrCreateCurator(
  opportunityName: string,
  curatorData?: TurtleCurator
): Promise<string> {
  // Use API curator name if available, otherwise extract from vault name
  const rawName = curatorData?.name ?? extractCuratorFromVaultName(opportunityName);
  const normalizedLower = rawName.toLowerCase().trim();

  // Resolve through alias map
  const canonicalName = CURATOR_NAME_ALIASES[normalizedLower] ?? rawName;

  // Try case-insensitive DB lookup by canonical name
  const existing = await prisma.curator.findFirst({
    where: {
      name: { equals: canonicalName, mode: "insensitive" },
    },
  });

  if (existing) {
    return existing.id;
  }

  // Also try the raw API name directly (in case alias didn't match but DB has it)
  if (canonicalName !== rawName) {
    const byRaw = await prisma.curator.findFirst({
      where: {
        name: { equals: rawName, mode: "insensitive" },
      },
    });
    if (byRaw) {
      return byRaw.id;
    }
  }

  // Create new curator with synthetic address
  const syntheticAddress = `turtle-${slugify(canonicalName)}`;

  // Check if synthetic address already exists
  const bySynthetic = await prisma.curator.findUnique({
    where: { address: syntheticAddress },
  });
  if (bySynthetic) {
    return bySynthetic.id;
  }

  const created = await prisma.curator.create({
    data: {
      address: syntheticAddress,
      name: canonicalName,
    },
  });

  return created.id;
}
