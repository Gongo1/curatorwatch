import { revalidatePath } from "next/cache";

/**
 * Revalidate every ISR page after a cron collection writes fresh data.
 * Pages set `revalidate = 21600` as a fallback ceiling; this keeps served
 * HTML aligned to the actual ingestion cadence instead of the clock.
 */
export function revalidateDataPages(): void {
  revalidatePath("/");
  revalidatePath("/yields");
  revalidatePath("/curator/[address]", "page");
  revalidatePath("/vault/[address]", "page");
  revalidatePath("/digest");
  revalidatePath("/feed/digest.xml");
}
