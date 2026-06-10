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

/** Same ceiling expressed in percentage units (for `netAPR` / `estTotalAPR`). */
export const MAX_SANE_APY_PCT = MAX_SANE_APY * 100;

/**
 * Sanitize a PERCENTAGE-units APY (e.g. Turtle `netAPR` / `estTotalAPR`, where
 * 8.33 means 8.33%). Returns null when implausible so the UI shows "—" rather
 * than a fabricated number. This is what caught the Turtle-reported 5,769% APR
 * on Midas "Staked Plasma USD".
 */
export function sanitizeApyPct(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (Math.abs(value) > MAX_SANE_APY_PCT) return null;
  return value;
}

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
