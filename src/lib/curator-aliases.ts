/**
 * Curator Address Alias Mapping
 *
 * Some curators (e.g. KPK, Gauntlet, Morpho) use multiple on-chain addresses
 * across their vaults. This module maps alias addresses to a single primary
 * address so they are treated as one curator in the DB and UI.
 */

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
      "0xee21e29237acf9e750a0625232a886e7bad47171",
      "0xb0888577fa9ae5bcc3e57dcc5d2a10c9b5c3374a",
      "0x79f54616fe18e92728ba22fba4e7d0febb1afa2d",
      "0xe8a0eb7b71b9e352ac56d3e94f5fa804b02fd491",
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
