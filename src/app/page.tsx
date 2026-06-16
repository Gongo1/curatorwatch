import { fetchAllDashboardData } from "@/lib/dashboard-queries";
import { fetchRecentNews } from "@/lib/news/queries";
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

  return (
    <CuratorsHome
      // Drop the per-vault array from the home payload — only /compare reads it (via
      // /api/dashboard). Keeps the highest-traffic page's RSC payload slim.
      curators={data.curators.data.curators.map((c) => ({ ...c, vaults: [] }))}
      stats={data.curators.data.stats}
      apyDist={data.apyDistribution ?? null}
      news={news}
    />
  );
}
