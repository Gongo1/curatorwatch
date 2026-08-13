/**
 * Shared sentence composition for the curator "About" blurb — used by the
 * profile card (CuratorBlurb) and the Curator Daily spotlight so the two
 * surfaces never drift. Pure text assembly: every number comes from the
 * caller's computed stats, every curated fact from the dossier registry.
 */

import { formatCurrency } from "@/lib/utils/format";
import type { CuratorDossier } from "@/lib/curator-dossier";

export interface BlurbStats {
  name: string;
  vaultCount: number;
  tvlUsd: number;
  chainCount: number;
  protocolCount: number;
  assetCount: number;
  /** Stablecoin symbols ranked by TVL contribution. */
  stables: string[];
  /** Earliest on-chain vault inception year, when a source supplies it. */
  sinceYear: number | null;
}

/** Sparse DB dossier fields used as fallback when the registry omits them. */
export interface BlurbDbFacts {
  foundedYear?: number | null;
  legalName?: string | null;
  headquarters?: string | null;
}

export function composeBlurbSentences(
  s: BlurbStats,
  dossier: CuratorDossier | null,
  db: BlurbDbFacts = {}
): string[] {
  const sentences: string[] = [];
  sentences.push(
    `${s.name} curates ${s.vaultCount} tracked vault${s.vaultCount === 1 ? "" : "s"} managing ${formatCurrency(s.tvlUsd)} across ${s.chainCount} chain${s.chainCount === 1 ? "" : "s"} and ${s.protocolCount} protocol${s.protocolCount === 1 ? "" : "s"}.`
  );
  if (s.stables.length > 0) {
    sentences.push(
      `The book spans ${s.assetCount} asset${s.assetCount === 1 ? "" : "s"}, ${
        s.stables.length === s.assetCount ? "all" : s.stables.length
      } of them stablecoins${
        s.stables.length > 1 ? ` led by ${s.stables.slice(0, 4).join(", ")}` : ` (${s.stables[0]})`
      }.`
    );
  }
  if (s.sinceYear) {
    sentences.push(`On-chain vault track record since ${s.sinceYear}.`);
  }

  const foundedYear = dossier?.foundedYear ?? db.foundedYear;
  const entity = dossier?.entity ?? db.legalName;
  const hq = dossier?.hq ?? db.headquarters;
  const idParts = [foundedYear ? `Founded ${foundedYear}` : null, entity, hq].filter(Boolean);
  if (idParts.length) sentences.push(`${idParts.join(" · ")}.`);

  const registrations = dossier?.registrations ?? [];
  if (registrations.length) sentences.push(`${registrations.join("; ")}.`);

  if (dossier?.fundingNote) {
    sentences.push(`${dossier.fundingNote}.`.replace(/\.\.$/, "."));
  } else if (dossier?.backers?.length) {
    sentences.push(`Backed by ${dossier.backers.slice(0, 4).join(", ")}.`);
  }

  return sentences;
}
