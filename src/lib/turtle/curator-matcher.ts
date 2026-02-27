/**
 * Matches Turtle curator names to existing DB curators.
 * 1. Extract curator name from opportunity name
 * 2. Check static mapping for known variants
 * 3. Case-insensitive DB lookup
 * 4. If no match: create new Curator with synthetic address
 */

import { prisma } from "@/lib/db";
import { extractCuratorFromVaultName } from "@/lib/utils/extract-curator-name";

/**
 * Static mapping for known curator name variants in Turtle data.
 * Maps Turtle names to canonical DB names.
 */
const CURATOR_NAME_ALIASES: Record<string, string> = {
  "re7": "Re7 Labs",
  "re7 labs": "Re7 Labs",
  "re7 capital": "Re7 Labs",
  "gauntlet": "Gauntlet",
  "steakhouse": "Steakhouse Financial",
  "steakhouse financial": "Steakhouse Financial",
  "mev capital": "MEV Capital",
  "block analitica": "Block Analitica",
  "yearn": "Yearn",
  "yearn finance": "Yearn",
  "morpho association": "Morpho Association",
  "instadapp": "Instadapp",
  "idle": "Idle Finance",
  "idle finance": "Idle Finance",
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Find or create a curator for a Turtle opportunity.
 * Returns the curator ID.
 */
export async function findOrCreateCurator(
  opportunityName: string
): Promise<string> {
  // Extract curator name from opportunity name
  const extractedName = extractCuratorFromVaultName(opportunityName);
  const normalizedLower = extractedName.toLowerCase();

  // Check static aliases
  const canonicalName =
    CURATOR_NAME_ALIASES[normalizedLower] ?? extractedName;

  // Try case-insensitive DB lookup by name
  const existing = await prisma.curator.findFirst({
    where: {
      name: { equals: canonicalName, mode: "insensitive" },
    },
  });

  if (existing) {
    return existing.id;
  }

  // Also try the extracted name directly (in case alias didn't match)
  if (canonicalName !== extractedName) {
    const byExtracted = await prisma.curator.findFirst({
      where: {
        name: { equals: extractedName, mode: "insensitive" },
      },
    });
    if (byExtracted) {
      return byExtracted.id;
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
