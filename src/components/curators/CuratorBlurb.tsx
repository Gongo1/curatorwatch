"use client";

import { ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import { isStablecoin } from "@/lib/utils/asset-class";
import { getCuratorDossier } from "@/lib/curator-dossier";
import type { CuratorProfile, CuratorVaultSummary } from "@/lib/types/api";

// The profile "About" blurb: one paragraph of live computed figures (every
// curator) plus curated, source-backed facts and third-party quotes (top
// curators, from the enrichment registry). Deterministic composition — no
// number appears here that wasn't computed or hand-verified.

export function CuratorBlurb({
  curator,
  vaults,
}: {
  curator: CuratorProfile;
  vaults: CuratorVaultSummary[];
}) {
  const name = curator.name || "This curator";
  const enrich = getCuratorDossier(curator.address);

  // ── Live figures from tracked vaults ──
  const tvl = vaults.reduce((s, v) => s + (v.latestSnapshot?.totalAssetsUsd ?? 0), 0);
  const chains = new Set(vaults.map((v) => v.chainId)).size;
  const protocols = new Set(vaults.map((v) => v.protocol || "morpho")).size;

  // Stables ranked by TVL so the names quoted are the ones that matter.
  const byAsset = new Map<string, number>();
  for (const v of vaults) {
    const sym = v.asset.symbol;
    byAsset.set(sym, (byAsset.get(sym) ?? 0) + (v.latestSnapshot?.totalAssetsUsd ?? 0));
  }
  const assetCount = byAsset.size;
  const stables = [...byAsset.entries()]
    .filter(([sym]) => isStablecoin(sym))
    .sort((a, b) => b[1] - a[1])
    .map(([sym]) => sym);

  // Earliest on-chain vault inception (Morpho supplies it; other sources may not).
  const inceptions = vaults
    .map((v) => v.creationTimestamp)
    .filter((t): t is number => typeof t === "number" && t > 0);
  const sinceYear = inceptions.length
    ? new Date(Math.min(...inceptions) * 1000).getUTCFullYear()
    : null;

  const sentences: string[] = [];
  sentences.push(
    `${name} curates ${vaults.length} tracked vault${vaults.length === 1 ? "" : "s"} managing ${formatCurrency(tvl)} across ${chains} chain${chains === 1 ? "" : "s"} and ${protocols} protocol${protocols === 1 ? "" : "s"}.`
  );
  if (stables.length > 0) {
    sentences.push(
      `The book spans ${assetCount} asset${assetCount === 1 ? "" : "s"}, ${
        stables.length === assetCount ? "all" : stables.length
      } of them stablecoins${stables.length > 1 ? ` led by ${stables.slice(0, 4).join(", ")}` : ` (${stables[0]})`}.`
    );
  }
  if (sinceYear) {
    sentences.push(`On-chain vault track record since ${sinceYear}.`);
  }

  // ── Curated facts (registry first, sparse DB dossier fields as fallback) ──
  const foundedYear = enrich?.foundedYear ?? curator.foundedYear;
  const entity = enrich?.entity ?? curator.legalName;
  const hq = enrich?.hq ?? curator.headquarters;
  const idParts = [
    foundedYear ? `Founded ${foundedYear}` : null,
    entity,
    hq,
  ].filter(Boolean);
  if (idParts.length) sentences.push(`${idParts.join(" · ")}.`);

  const registrations = enrich?.registrations ?? [];
  if (registrations.length) sentences.push(`${registrations.join("; ")}.`);

  if (enrich?.fundingNote) {
    sentences.push(`${enrich.fundingNote}.`.replace(/\.\.$/, "."));
  } else if (enrich?.backers?.length) {
    sentences.push(`Backed by ${enrich.backers.slice(0, 4).join(", ")}.`);
  }

  const quote = enrich?.quotes?.[0] ?? null;

  return (
    <section className="mb-8 max-w-[820px] border border-border rounded-2xl bg-background-subtle p-5">
      <div className="font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary mb-2">
        About {name}
      </div>
      <p className="text-[15px] leading-relaxed text-text-secondary">
        {sentences.join(" ")}
      </p>

      {enrich?.highlights && enrich.highlights.length > 0 && (
        <ul className="mt-3 space-y-1">
          {enrich.highlights.slice(0, 3).map((h, i) => (
            <li key={i} className="flex gap-2 text-sm text-text-secondary">
              <span className="text-accent-blue flex-none">›</span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}

      {quote && (
        <blockquote className="mt-4 border-l-2 border-accent-blue/50 pl-4">
          <p className="text-sm italic text-text-primary">“{quote.text}”</p>
          <a
            href={quote.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-text-tertiary hover:text-accent-blue transition-colors"
          >
            — {quote.source}
            {quote.date ? `, ${quote.date}` : ""}
            <ExternalLink className="w-3 h-3" />
          </a>
        </blockquote>
      )}

      {enrich?.cautions && enrich.cautions.length > 0 && (
        <p className="mt-3 text-xs text-accent-yellow/90">
          <span className="font-mono uppercase tracking-wide">Notable events:</span>{" "}
          {enrich.cautions[0]}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-text-muted">
        <span>Figures computed live from tracked vaults{enrich ? " · profile facts curated with sources" : ""}</span>
        {enrich?.research && (
          <a
            href={enrich.research.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-text-tertiary hover:text-accent-blue transition-colors"
          >
            Publishes {enrich.research.name}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </section>
  );
}
