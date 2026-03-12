/**
 * APY sanity checks.
 *
 * The Morpho API occasionally returns corrupted APY values (e.g. 220,939
 * instead of 0.05). These utilities cap values at a sensible maximum so
 * a single bad snapshot can never inflate aggregate stats.
 *
 * All APY values in our DB are stored as decimals (0.05 = 5%).
 */

/** Maximum APY we consider plausible (200% = 2.0 in decimal). */
export const MAX_SANE_APY = 2.0;

/**
 * Return the APY if it looks reasonable, otherwise 0.
 * Use this when reading `avgNetApy` / `avgApy` from snapshots.
 */
export function sanitizeApy(value: number | null | undefined): number {
  if (value == null) return 0;
  if (Math.abs(value) > MAX_SANE_APY) return 0;
  return value;
}

/**
 * Return the APY if it looks reasonable, otherwise null.
 * Use this when writing snapshots to the DB (preserves null semantics).
 */
export function sanitizeApyForStorage(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (Math.abs(value) > MAX_SANE_APY) return null;
  return value;
}
