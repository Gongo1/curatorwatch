/**
 * Material off-chain disclosures for curators — litigation, regulatory, governance.
 *
 * These are events the loss-anchored Expected-Loss engine cannot price (it sees only
 * on-chain loss channels), so they are surfaced separately and prominently on the
 * curator profile. Each is sourced and dated. They do NOT change the engine grade;
 * they sit alongside it as context.
 *
 * Keyed by curator address (0x… lowercased). Distinct from `incidents.ts`, which is
 * specifically about bad-debt / realized-loss exposure.
 */

export interface CuratorDisclosure {
  /** Short headline, e.g. "Active fraud litigation". */
  title: string;
  /** One or two neutral sentences of context. */
  detail: string;
  /** ISO date of the event / filing. */
  date: string;
  /** Primary source URL. */
  sourceUrl: string;
  /** Human-readable source title. */
  sourceTitle: string;
  /** Visual emphasis. */
  severity: "warning" | "critical";
}

export const CURATOR_DISCLOSURES: Record<string, CuratorDisclosure[]> = {
  // RockawayX — Brera/Solmate fraud suit + SEC Section 13(d) "group" demand.
  "0xbbacdcfb9691dfa1066ab29edfcc4a73f6def918": [
    {
      title: "Active fraud litigation against the curator entity",
      detail:
        "Brera Holdings PLC (d/b/a Solmate Infrastructure, Nasdaq: SLMT) has sued RockawayX a.s., RockawayX Holding a.s., and founder Viktor Fischer in Delaware Superior Court (public complaint filed June 4, 2026) for fraud, intentional interference, and unjust enrichment — alleging RockawayX marketed materially overstated, unsubstantiable profitability to induce a now-failed acquisition. A parallel June 12, 2026 demand letter alleges an undisclosed SEC Section 13(d) “group.” Unproven allegations in active litigation. The Expected-Loss grade is computed from on-chain loss channels and does not reflect this off-chain governance risk.",
      date: "2026-06-04",
      sourceUrl:
        "https://www.sec.gov/Archives/edgar/data/38264/000168316826004852/forward_ex9901.htm",
      sourceTitle: "Forward Industries 8-K, Exhibit 99.1 (demand letter + complaint) — SEC EDGAR",
      severity: "critical",
    },
  ],
};

export function getCuratorDisclosures(address: string | null | undefined): CuratorDisclosure[] {
  if (!address) return [];
  return CURATOR_DISCLOSURES[address.toLowerCase()] ?? [];
}
