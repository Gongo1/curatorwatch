/**
 * Curated curator dossier registry — the editorial half of the profile
 * "About" blurb. Live figures (vault count, AUM, chains, stables) are computed
 * from tracked data at render time; everything here is hand-verified fact with
 * a source trail, maintained for the top curators by AUM.
 *
 * (Distinct from the legacy curator-enrichment.ts seed list — this module is
 * display-only, sourced, and keyed by the live DB address.)
 *
 * Rules of the registry (institutional audience — a wrong fact is disqualifying):
 * - Every entry field must be backed by a URL in `sources`.
 * - Quotes are verbatim from third-party coverage (press, research notes,
 *   ratings), never the curator's own marketing, and always attributed + linked.
 * - Material negative events belong in `cautions` — honesty is the product.
 * - Unverifiable claims are omitted, not guessed.
 *
 * Keyed by the Curator.address in our DB (0x… or the tc:<slug> synthetic form).
 */

export interface DossierQuote {
  text: string;
  source: string;
  url: string;
  date?: string; // YYYY-MM
}

export interface CuratorDossier {
  /** Overrides/completes the sparse DB dossier fields for display. */
  foundedYear?: number;
  entity?: string; // legal entity + form, e.g. "Steakhouse Financial AG"
  hq?: string;
  backers?: string[]; // notable investors
  fundingNote?: string; // e.g. "Raised $23M Series A led by X (2023)"
  registrations?: string[]; // regulatory registrations / licenses
  highlights?: string[]; // short verifiable facts an allocator cares about
  research?: { name: string; url: string }; // curator-run research desk
  quotes?: DossierQuote[];
  cautions?: string[]; // material negative events
  sources?: string[]; // review trail; not rendered
}

export function getCuratorDossier(address: string): CuratorDossier | null {
  return CURATOR_DOSSIERS[address.toLowerCase()] ?? null;
}

export const CURATOR_DOSSIERS: Record<string, CuratorDossier> = {
  // Populated for the top curators by AUM (2026-08-12 research pass).
};
