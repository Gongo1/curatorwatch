/**
 * CLI runner for the Turtle collection pipeline.
 * Usage: npm run collect:turtle
 *
 * The pipeline itself lives in ./collect-turtle-data.ts; this just invokes it and
 * cleanly disconnects Prisma (avoids the idle-connection leaks we hit before).
 */
import { collectTurtleData } from "./collect-turtle-data";
import { prisma } from "../lib/db";

async function main() {
  const r = await collectTurtleData();
  console.log("\n=== RESULT ===");
  console.log(
    JSON.stringify(
      {
        success: r.success,
        totalFetched: r.totalFetched,
        filtered: r.filtered,
        vaultsUpserted: r.vaultsUpserted,
        vaultsAttributed: r.vaultsAttributed,
        skipped: r.unmatchedHidden,
        errors: r.errors.length,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
