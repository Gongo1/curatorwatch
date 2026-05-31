/**
 * Documented incidents affecting curators, keyed by curator address.
 *
 * IMPORTANT FRAMING: the `exposureUsd` figures are EXPOSURE — at-risk loan amounts
 * attributed by third-party forensic analysis (primarily the "Yields & More" creditor
 * map) — NOT confirmed realized losses. Each entry is sourced and dated, and `note`
 * carries the caveat. Present them factually and neutrally; this is published.
 *
 * Keyed by curator address: 0x… lowercased, or a `tc:<slug>` synthetic address.
 * Replaces the old name-substring `KNOWN_BAD_DEBT_CURATORS` maps (fragile, unsourced)
 * that lived in curator-risk-profile.ts and curator-rating.ts.
 */

export interface CuratorIncident {
  /** Short event name. */
  event: string;
  /** At-risk exposure in USD (third-party estimate), or null if unquantified. */
  exposureUsd: number | null;
  /** Token(s) involved. */
  token: string;
  /** ISO date of the event / disclosure. */
  date: string;
  /** Primary source URL. */
  sourceUrl: string;
  /** Human-readable source title. */
  sourceTitle: string;
  /** Confidence in the attributed figure. */
  confidence: "high" | "medium" | "low";
  /** Neutral caveat / context, e.g. "exposure, not realized loss". */
  note: string;
}

const STREAM = "Stream Finance collapse";

/** Address (lowercased / tc:slug) → incidents. */
export const CURATOR_INCIDENTS: Record<string, CuratorIncident[]> = {
  // TelosC — largest single curator exposure in the Stream Finance collapse.
  "tc:telosc": [
    {
      event: `${STREAM} (xUSD depeg)`,
      exposureUsd: 123_640_000,
      token: "xUSD",
      date: "2025-11-04",
      sourceUrl:
        "https://www.theblock.co/post/377491/analysts-map-285m-in-potential-exposure-across-defi-after-stream-finances-93m-loss",
      sourceTitle:
        "Analysts map $285M in potential exposure across DeFi after Stream Finance's $93M loss — The Block",
      confidence: "high",
      note: "Largest single curator exposure in the event. Estimated at-risk exposure per third-party forensic analysis (Yields & More); not a confirmed realized loss — recovery was pending as of reporting.",
    },
  ],

  // Re7 Labs.
  "0x72882eb5d27c7088dfa6dde941dd42e5d184f0ef": [
    {
      event: `${STREAM} (xUSD + deUSD contagion)`,
      exposureUsd: 27_400_000,
      token: "xUSD / deUSD",
      date: "2025-11-06",
      sourceUrl:
        "https://protos.com/stream-finance-meltdown-winners-and-losers-in-defi-risk-curator-reckoning/",
      sourceTitle:
        "Stream Finance meltdown: winners and losers in DeFi 'risk curator' reckoning — Protos",
      confidence: "medium",
      note: "~$14.65M xUSD-direct plus ~$12.75M deUSD contagion, per Re7's incident report via Protos — exposure, not all realized loss. Re7 began cutting Stream exposure on Oct 27. A separate ~$13.1M StableLabs/USDX exposure is excluded.",
    },
  ],

  // MEV Capital.
  "0x38989bba00bdf8181f4082995b3deae96163ac5d": [
    {
      event: `${STREAM} (xUSD)`,
      exposureUsd: 25_420_000,
      token: "xUSD",
      date: "2025-11-04",
      sourceUrl: "https://blockeden.xyz/blog/2025/11/08/m-defi-contagion/",
      sourceTitle:
        "Anatomy of a $285M DeFi Contagion — BlockEden (citing Yields & More)",
      confidence: "medium",
      note: "Estimated exposure per third-party forensic analysis. MEV Capital states most was user-deposited funds in permissionless markets, not house losses, and its actively-managed vaults had no direct Stream exposure.",
    },
  ],
};

export interface IncidentSummary {
  hasEvents: boolean;
  /** Sum of quantified exposures (USD). */
  totalExposure: number;
  /** First (primary) event name, or null. */
  primaryEvent: string | null;
  incidents: CuratorIncident[];
}

/** Incidents for a curator address (0x… or tc:slug). Empty array if none. */
export function getCuratorIncidents(
  address: string | null | undefined,
): CuratorIncident[] {
  if (!address) return [];
  return CURATOR_INCIDENTS[address.toLowerCase()] ?? CURATOR_INCIDENTS[address] ?? [];
}

/** Summary for a curator address, including a quantified total exposure. */
export function summarizeIncidents(
  address: string | null | undefined,
): IncidentSummary {
  const incidents = getCuratorIncidents(address);
  return {
    hasEvents: incidents.length > 0,
    totalExposure: incidents.reduce((s, i) => s + (i.exposureUsd ?? 0), 0),
    primaryEvent: incidents[0]?.event ?? null,
    incidents,
  };
}
