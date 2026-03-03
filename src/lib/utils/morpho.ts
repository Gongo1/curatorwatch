/**
 * Generate Morpho vault URL for external linking
 */
export function getMorphoVaultUrl(vaultAddress: string, vaultName: string): string {
  // Convert vault name to URL-friendly slug
  const slug = vaultName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `https://app.morpho.org/ethereum/vault/${vaultAddress}/${slug}`;
}

/**
 * Generate Morpho market URL
 */
export function getMorphoMarketUrl(marketId: string): string {
  return `https://app.morpho.org/ethereum/market/${marketId}`;
}

/**
 * Generate the appropriate deposit URL based on vault data source
 */
export function getVaultDepositUrl(
  vaultAddress: string,
  vaultName: string,
  dataSource?: string | null,
  turtleId?: string | null,
): string {
  if (dataSource === "turtle") {
    if (turtleId) {
      return `https://app.turtle.xyz/earn/opportunities/${turtleId}`;
    }
    return "https://app.turtle.xyz/earn";
  }
  return getMorphoVaultUrl(vaultAddress, vaultName);
}

/**
 * Get the deposit CTA label based on data source
 */
export function getDepositLabel(dataSource?: string | null): string {
  if (dataSource === "turtle") {
    return "View on Turtle";
  }
  return "View on Morpho";
}

/**
 * Generate Etherscan URL for address
 */
export function getEtherscanUrl(address: string, type: 'address' | 'token' | 'tx' = 'address'): string {
  return `https://etherscan.io/${type}/${address}`;
}
