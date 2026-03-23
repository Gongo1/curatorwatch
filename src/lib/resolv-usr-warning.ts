/**
 * Resolv USR exposure tracking.
 * Vaults with known exposure to Resolv USR markets.
 */

export const RESOLV_USR_VAULT_ADDRESSES: string[] = [
  "0x8eB67A509616cd6A7c1B3c8C21D48FF57df3d458",
  "0x12AFDeFb2237a5963e7BAb3e2D46ad0eee70406e",
  "0x23479229e52Ab6aaD312D0B03DF9F33B46753B5e",
  "0x9178eBE0691593184c1D785a864B62a326cc3509",
  "0xd63070114470f685b75B74D60EEc7c1113d33a3D",
  "0x6C26793c7F1e2785c09b460676e797b716f0Bc8E",
  "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738",
];

// Lowercase set for fast lookups
const RESOLV_USR_SET = new Set(
  RESOLV_USR_VAULT_ADDRESSES.map((a) => a.toLowerCase())
);

export function isResolvUsrExposed(address: string): boolean {
  return RESOLV_USR_SET.has(address.toLowerCase());
}

export const RESOLV_USR_WARNING =
  "This vault has exposure to Resolv USR markets. Withdraw immediately if liquidity is available.";
