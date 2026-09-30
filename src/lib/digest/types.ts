import type { CuratorStressIndex } from "@/lib/stress-index";
import type { AssetConcentration } from "@/lib/concentration";

export interface DigestFlowItem {
  curatorId: string;
  name: string | null;
  slug: string;
  deltaUsd: number;
  pct: number; // % change vs ~24h baseline
  currentUsd: number;
}

export interface DigestNewVault {
  name: string;
  curator: string | null;
  curatorSlug: string | null;
  assetSymbol: string;
  chainName: string;
  tvl: number;
}

export interface DigestYieldMover {
  vaultName: string;
  curator: string | null;
  assetSymbol: string;
  oldApyPct: number;
  newApyPct: number;
  deltaPct: number;
}

export interface DigestIncidents {
  count: number;
  badDebtUsd: number;
  seizedUsd: number;
  topCurators: { curator: string; seizedUsd: number }[];
  /** True when the liquidation feed was past its SLA: incidents omitted, not zero. */
  stale?: boolean;
}

/** One source's newest data at build time (digests since 2026-09-30). */
export interface DigestSourceAsOf {
  key: string;
  label: string;
  lastAt: string | null; // ISO
  stale: boolean;
}

export interface DigestNewsItem {
  title: string;
  url: string;
  source: string;
  curator: string | null;
  publishedAt: string; // ISO
}

/** Daily rotating curator feature, composed from the dossier registry + live stats. */
export interface DigestSpotlight {
  name: string;
  slug: string;
  sentences: string[];
  highlight: string | null;
  quote: { text: string; source: string; url: string } | null;
}

/** The machine-readable digest body — the source of truth the prose renders from. */
export interface DigestData {
  slug: string; // "2026-06-15"
  date: string; // ISO publish timestamp
  windowHours: number;
  ecosystem: {
    totalTvl: number;
    curatorCount: number;
    vaultCount: number;
    stableTvl: number;
    stablePct: number;
    netFlowUsd: number;
    netFlowPct: number;
  };
  stress: CuratorStressIndex;
  concentration: AssetConcentration[];
  topInflows: DigestFlowItem[];
  topOutflows: DigestFlowItem[];
  newVaults: DigestNewVault[];
  yieldMovers: DigestYieldMover[];
  incidents: DigestIncidents;
  alertCounts: { critical: number; warning: number; info: number };
  /** Optional — absent on digests stored before 2026-08-13. */
  news?: DigestNewsItem[];
  spotlight?: DigestSpotlight | null;
  /** Optional — absent on digests stored before 2026-09-30. */
  asOf?: DigestSourceAsOf[];
  /** Vault sources left out of the tables because they were past SLA. */
  excludedSources?: string[];
}
