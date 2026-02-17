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
 * Generate Etherscan URL for address
 */
export function getEtherscanUrl(address: string, type: 'address' | 'token' | 'tx' = 'address'): string {
  return `https://etherscan.io/${type}/${address}`;
}
