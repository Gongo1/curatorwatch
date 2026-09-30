/**
 * Which vault rows count toward totals: the single definition every aggregate
 * uses (curator AUM, home/directory totals, lenses, stablecoin mix, digest).
 *
 * A vault counts only when it is active AND listed AND countInTotals AND its
 * last snapshot is fresh (within STALE_AFTER_DAYS). Rows that fail the test
 * stay visible on their own pages with a "not counted in totals" note.
 *
 * Isomorphic: no Prisma runtime import, so client components can use the
 * labels. Server code gets the Prisma where-fragment from countedVaultWhere().
 */

import type { Prisma } from "@prisma/client";

/** A row with no snapshot for this long is stale and not counted. */
export const STALE_AFTER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Stored in Vault.excludeReason (see prisma/manual-sql/2026-09-30-*). */
export const EXCLUDE_REASONS = [
  "wrapper",
  "bridged",
  "nested",
  "cross_source_dup",
  "phantom",
  "unlisted",
] as const;
export type ExcludeReason = (typeof EXCLUDE_REASONS)[number];

/** Why a row is not counted: a stored reason, or a state the row is in. */
export type NotCountedReason = ExcludeReason | "inactive" | "stale" | "excluded";

export const NOT_COUNTED_LABELS: Record<NotCountedReason, string> = {
  wrapper: "wrapper of a token that is already counted",
  bridged: "bridged copy, counted on its home chain",
  nested: "deposits of a token that is already counted",
  cross_source_dup: "same vault is tracked by another source",
  phantom: "implausible accrual (phantom TVL)",
  unlisted: "not listed by the protocol",
  inactive: "inactive",
  stale: `no fresh data for ${STALE_AFTER_DAYS}+ days`,
  excluded: "excluded from totals",
};

/** Freshness cutoff: snapshots at or after this instant are fresh. */
export function staleCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - STALE_AFTER_DAYS * DAY_MS);
}

/** Prisma where-fragment for counted vaults. Spread into a Vault where. */
export function countedVaultWhere(now: Date = new Date()): Prisma.VaultWhereInput {
  return {
    active: true,
    listed: true,
    countInTotals: true,
    lastSnapshotAt: { gte: staleCutoff(now) },
  };
}

/**
 * Structural part only (no activity/freshness): for historical series, where a
 * vault that has since closed or gone quiet must keep its past history.
 */
export const COUNTED_STRUCTURAL_WHERE: Prisma.VaultWhereInput = {
  listed: true,
  countInTotals: true,
};

export interface CountingFields {
  active: boolean;
  listed: boolean;
  countInTotals: boolean;
  excludeReason: string | null;
  lastSnapshotAt: Date | string | null;
}

export interface VaultCountingStatus {
  counted: boolean;
  /** First reason the row is not counted; null when counted. */
  reason: NotCountedReason | null;
  /** ISO time of the last snapshot when the row is stale; else null. */
  staleSince: string | null;
}

function toDate(v: Date | string | null): Date | null {
  if (v == null) return null;
  return v instanceof Date ? v : new Date(v);
}

/** Same test as countedVaultWhere(), for rows already in memory. */
export function vaultCountingStatus(
  v: CountingFields,
  now: Date = new Date()
): VaultCountingStatus {
  const last = toDate(v.lastSnapshotAt);
  const stale = last === null || last < staleCutoff(now);
  const staleSince = stale && last ? last.toISOString() : null;

  let reason: NotCountedReason | null = null;
  if (!v.active) reason = "inactive";
  else if (!v.countInTotals)
    reason = (EXCLUDE_REASONS as readonly string[]).includes(v.excludeReason ?? "")
      ? (v.excludeReason as ExcludeReason)
      : "excluded";
  else if (!v.listed) reason = "unlisted";
  else if (stale) reason = "stale";

  return { counted: reason === null, reason, staleSince };
}

export function isCountedVault(v: CountingFields, now: Date = new Date()): boolean {
  return vaultCountingStatus(v, now).counted;
}
