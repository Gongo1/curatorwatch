import { fetchAllDashboardData } from "@/lib/dashboard-queries";
import { CuratorsHome } from "./home-client";

// ISR aligned to the ingestion cadence: the cron revalidates this page on
// completion (see /api/cron/*); 6h is the fallback ceiling if a trigger is missed.
export const revalidate = 21600;

export default async function Page() {
  const data = await fetchAllDashboardData({
    page: 1,
    pageSize: 100,
    sortBy: "aum",
    sortOrder: "desc",
  });

  return (
    <CuratorsHome
      curators={data.curators.data.curators}
      stats={data.curators.data.stats}
      apyDist={data.apyDistribution ?? null}
    />
  );
}
