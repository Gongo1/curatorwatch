/**
 * READ-ONLY triage of synthetic `turtle-*` curators.
 *
 * Joins each synthetic curator's vaults back to the live Turtle API by turtleId
 * to surface the authoritative signal Turtle itself provides:
 *   - opp.curator (name / description / landingUrl) — present ⇒ Turtle labels it a curator
 *   - opp.protocol — the protocol the vault lives on
 *   - opp.name — the vault/opportunity title (used as the synthetic name when no curator)
 *
 * Output feeds a manual classification: real-curator-to-promote vs protocol/pool/junk.
 * Writes nothing. Usage: npx tsx --env-file=.env src/scripts/triage-synthetic-curators.ts
 */

import { PrismaClient } from "@prisma/client";
import { fetchTurtleOpportunities } from "../lib/turtle/client";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  log: ["error"],
});

async function main() {
  const synthetic = await prisma.curator.findMany({
    where: { address: { startsWith: "turtle-" } },
    select: {
      address: true,
      name: true,
      totalAssetsManaged: true,
      vaults: {
        select: {
          name: true,
          turtleId: true,
          protocol: true,
          assetSymbol: true,
          snapshots: { orderBy: { timestamp: "desc" }, take: 1, select: { totalAssetsUsd: true } },
        },
      },
    },
  });

  const opps = await fetchTurtleOpportunities();
  const byTurtleId = new Map(opps.map((o) => [o.id, o]));

  const rows = synthetic
    .map((c) => {
      const tvl = c.totalAssetsManaged ?? 0;
      const vaults = c.vaults.map((v) => {
        const opp = v.turtleId ? byTurtleId.get(v.turtleId) : undefined;
        return {
          vaultName: v.name,
          dbProtocol: v.protocol,
          turtleProtocol: opp?.protocol ?? null,
          asset: v.assetSymbol,
          tvl: v.snapshots[0]?.totalAssetsUsd ?? 0,
          turtleCuratorName: opp?.curator?.name ?? null,
          turtleCuratorLanding: opp?.curator?.landingUrl ?? null,
          turtleCuratorHasDesc: Boolean(opp?.curator?.description),
        };
      });
      const protocols = [...new Set(vaults.map((v) => v.turtleProtocol).filter(Boolean))];
      const hasCuratorObj = vaults.some((v) => v.turtleCuratorName);
      const landing = vaults.find((v) => v.turtleCuratorLanding)?.turtleCuratorLanding ?? null;
      return { name: c.name, address: c.address, tvl, protocols, hasCuratorObj, landing, vaults };
    })
    .sort((a, b) => b.tvl - a.tvl);

  for (const r of rows) {
    console.log(
      `\n● ${r.name}  [${r.address}]  $${(r.tvl / 1e6).toFixed(2)}M  ` +
        `| Turtle curator-object: ${r.hasCuratorObj ? "YES" : "no"}` +
        `${r.landing ? ` | ${r.landing}` : ""}` +
        `${r.protocols.length ? ` | protocol(s): ${r.protocols.join(", ")}` : ""}`
    );
    for (const v of r.vaults) {
      console.log(
        `    - ${v.vaultName}  ($${(v.tvl / 1e6).toFixed(2)}M, ${v.asset}, ${v.turtleProtocol ?? v.dbProtocol})` +
          `  turtleCurator=${v.turtleCuratorName ?? "—"}`
      );
    }
  }
  console.log(`\nTotal: ${rows.length} synthetic curators, $${(rows.reduce((s, r) => s + r.tvl, 0) / 1e6).toFixed(2)}M\n`);
}

main()
  .catch((e) => {
    console.error("triage FAILED:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
