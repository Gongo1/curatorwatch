/**
 * Curator Address Alias Mapping
 *
 * Some curators (e.g. KPK, Gauntlet, Morpho) use multiple on-chain addresses
 * across their vaults. This module maps alias addresses to a single primary
 * address so they are treated as one curator in the DB and UI.
 */

/**
 * Curators excluded from all aggregations, stats, and UI listings.
 * Their vaults will still exist in the DB but won't appear in any totals.
 */
export const EXCLUDED_CURATORS: string[] = ["Maxshot"];

/**
 * Prisma where clause fragment to exclude vaults belonging to excluded curators.
 * Use via: `where: { ...excludedCuratorFilter, ...otherFilters }`
 */
export const EXCLUDED_CURATOR_VAULT_FILTER = EXCLUDED_CURATORS.length > 0
  ? { NOT: { curator: { name: { in: EXCLUDED_CURATORS } } } }
  : {};

export interface CuratorAliasGroup {
  curatorName: string;
  primaryAddress: string;
  aliasAddresses: string[];
}

/**
 * Static alias groups — manually curated.
 * Primary address is the one with the highest AUM (kept in DB).
 * All addresses are lowercase.
 */
export const CURATOR_ALIAS_GROUPS: CuratorAliasGroup[] = [
  {
    curatorName: "KPK",
    primaryAddress: "0xc266b1181a80e84edc2c6596718e88e8115c1eaa",
    aliasAddresses: [
      "0xf8182e5827c06a47a985ec565a3bcd56437a97be",
      "0x7e43df1c1c5a2245858b60d4655fda83704e4171",
      "0xe5aec7d0e795456f90cebefba56470f0e5dfc075",
      "0xd15f11b334e1e233127302e5f759c17da1260df5",
    ],
  },
  {
    curatorName: "Gauntlet",
    primaryAddress: "0x9e33faae38ff641094fa68c65c2ce600b3410585",
    aliasAddresses: [
      "0x1b0448bf6bd7ef8165a6350191d7338f5c2464f4",
    ],
  },
  {
    curatorName: "Morpho Association",
    primaryAddress: "0x3e95e07fd5fa55b6f1f72ed2f9b5c0e4c6ff4d5a",
    aliasAddresses: [
      "0x0000000000000000000000000000000000000000",
    ],
  },
];

/**
 * Vault-level curator overrides.
 * Some vaults share an on-chain curator address but belong to different
 * entities (e.g. Clearstar and Re Ecosystem vaults use Re7's on-chain address).
 * Keys are lowercased vault addresses, values are the curator address to use.
 */
export const VAULT_CURATOR_OVERRIDES: Record<string, string> = {
  // Clearstar vaults — on-chain curator is Re7 but actual curator is Clearstar Labs AG
  "0x2b58132964f038461e3d8b56df582f49fecc8745": "clearstar",   // Clearstar Boring USDT
  "0xfa17f7aadbfac2c5d3c8125555404c1ae17df853": "clearstar",   // Clearstar Yield USDC
  "0x69a238ae7ebeb3c53ff3b544e48b96a2142fc284": "clearstar",   // Clearstar USDC Core
  "0xf3cc5c9a25508d8d959618fd48f6abc18ca4db49": "clearstar",   // Clearstar Boring USDC
  "0xd1e9242e075db4bdd3f3c721d7d5fd4180a94a7e": "clearstar",   // Re Ecosystem Vault (Clearstar)
};

/**
 * Generate a URL-friendly slug from a curator name.
 * Falls back to the raw address if no name is available.
 */
export function curatorSlug(name: string | null, address: string): string {
  if (!name) return address.toLowerCase();
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, "-")       // spaces/underscores → hyphens
    .replace(/[^a-z0-9-]/g, "")    // strip non-alphanumeric (except hyphens)
    .replace(/-{2,}/g, "-")        // collapse multiple hyphens
    .replace(/^-|-$/g, "");        // trim leading/trailing hyphens
}

/**
 * Resolve a curator slug (or hex address) to the primary curator address.
 * - If the input starts with `0x`, delegates to `resolveCuratorAddress`.
 * - Otherwise queries Prisma for a curator whose name slugifies to the input.
 */
export async function resolveCuratorSlug(slug: string): Promise<string> {
  if (slug.startsWith("0x")) {
    return resolveCuratorAddress(slug);
  }

  // Lazy-import prisma to avoid circular deps in non-server contexts
  const { prisma } = await import("@/lib/db");
  const curators = await prisma.curator.findMany({
    select: { address: true, name: true },
  });

  const match = curators.find(
    (c) => c.name && curatorSlug(c.name, c.address) === slug.toLowerCase()
  );

  if (match) return match.address.toLowerCase();

  // No match — return the slug as-is (will 404 downstream)
  return slug.toLowerCase();
}

/** Pre-built lookup: alias address -> primary address */
const aliasToPrimary = new Map<string, string>();
for (const group of CURATOR_ALIAS_GROUPS) {
  for (const alias of group.aliasAddresses) {
    aliasToPrimary.set(alias, group.primaryAddress);
  }
}

/**
 * Resolve an address to its primary curator address.
 * Returns the input unchanged if it is not a known alias.
 */
export function resolveCuratorAddress(address: string): string {
  return aliasToPrimary.get(address.toLowerCase()) ?? address.toLowerCase();
}

/**
 * Resolve the curator address for a vault, checking vault-level overrides first,
 * then falling back to the standard address alias resolution.
 */
export function resolveVaultCuratorAddress(vaultAddress: string, onChainCuratorAddress: string): string {
  const override = VAULT_CURATOR_OVERRIDES[vaultAddress.toLowerCase()];
  if (override) return override;
  return resolveCuratorAddress(onChainCuratorAddress);
}

/**
 * Given any address in an alias group, return the primary + all aliases.
 * Returns a single-element array if the address is not part of any group.
 */
export function getAllAddressesForCurator(address: string): string[] {
  const lower = address.toLowerCase();
  for (const group of CURATOR_ALIAS_GROUPS) {
    if (
      group.primaryAddress === lower ||
      group.aliasAddresses.includes(lower)
    ) {
      return [group.primaryAddress, ...group.aliasAddresses];
    }
  }
  return [lower];
}
