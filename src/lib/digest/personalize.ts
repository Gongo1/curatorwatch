/**
 * Personalized-digest primitive — the auth-agnostic engine behind the v2
 * "your watched curators moved today" edition. Pure function over a DigestData +
 * a watchlist, so it works today against the localStorage watchlist (client) and
 * unchanged against a server-persisted watchlist once accounts exist.
 *
 * NOTE: today's DigestData only carries the global top-5 movers, so this surfaces
 * watched curators that appear in today's top movers / concentration flags. The full
 * personalized edition (every watched curator, regardless of rank, delivered) needs a
 * per-user build pass + durable watchlists — see docs/personalized-digest-v2.md.
 */

import type { DigestData, DigestFlowItem } from "./types";
import type { AssetConcentration } from "@/lib/concentration";

export interface PersonalWatch {
  curatorIds: Set<string>; // curator.id (cuid) from the watchlist
  curatorNames: Set<string>;
}

export interface PersonalDigest {
  inflows: DigestFlowItem[];
  outflows: DigestFlowItem[];
  concentration: AssetConcentration[];
  hasMatches: boolean;
}

export function personalizeDigest(data: DigestData, watch: PersonalWatch): PersonalDigest {
  const inflows = data.topInflows.filter((f) => watch.curatorIds.has(f.curatorId));
  const outflows = data.topOutflows.filter((f) => watch.curatorIds.has(f.curatorId));
  const concentration = data.concentration.filter(
    (c) => c.topCurator != null && watch.curatorNames.has(c.topCurator)
  );
  return {
    inflows,
    outflows,
    concentration,
    hasMatches: inflows.length + outflows.length + concentration.length > 0,
  };
}
