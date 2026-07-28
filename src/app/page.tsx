import { fetchAllDashboardData } from "@/lib/dashboard-queries";
import { fetchRecentNews } from "@/lib/news/queries";
import { computeHomeOverview } from "@/lib/home-overview";
import { GATE_ENABLED, FREE_RANKING_ROWS, TEASE_NAMES } from "@/lib/gate/config";
import { CuratorsHome } from "./home-client";

// ISR aligned to the ingestion cadence: the cron revalidates this page on
// completion (see /api/cron/*); 6h is the fallback ceiling if a trigger is missed.
export const revalidate = 21600;

export default async function Page() {
  const [data, news] = await Promise.all([
    fetchAllDashboardData({
      page: 1,
      pageSize: 100,
      sortBy: "aum",
      sortOrder: "desc",
    }),
    fetchRecentNews(12),
  ]);

  const full = data.curators.data.curators;
  // First-viewport aggregates always come from the FULL set (hero must
  // reconcile with total TVL); the ranking rows are what the gate truncates.
  const overview = computeHomeOverview(full);
  const gated = GATE_ENABLED && full.length > FREE_RANKING_ROWS;
  const rows = gated ? full.slice(0, FREE_RANKING_ROWS) : full;
  const gate = gated
    ? {
        truncated: true,
        totalCount: full.length,
        teaseNames: full
          .slice(FREE_RANKING_ROWS, FREE_RANKING_ROWS + TEASE_NAMES)
          .map((c) => c.name),
      }
    : null;

  return (
    <CuratorsHome
      // Drop the per-vault array from the home payload — only /compare reads it (via
      // /api/dashboard). Keeps the highest-traffic page's RSC payload slim.
      curators={rows.map((c) => ({ ...c, vaults: [] }))}
      stats={data.curators.data.stats}
      apyDist={data.apyDistribution ?? null}
      news={news}
      overview={overview}
      gate={gate}
    />
  );
}
