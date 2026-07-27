import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DepositAppLoader } from "./DepositAppLoader";

// Feature-flagged via NEXT_PUBLIC_FEATURE_TURTLE_DEPOSIT. When the flag is anything
// other than "true", this route 404s and the deposit embed never reaches users —
// keeping `main` and the live site clean until the flag is flipped.
// Suspense: DepositApp reads ?opportunity= via useSearchParams (deal deep links).
export default function DepositPage() {
  if (process.env.NEXT_PUBLIC_FEATURE_TURTLE_DEPOSIT !== "true") {
    notFound();
  }
  return (
    <Suspense fallback={<div className="h-[60vh]" />}>
      <DepositAppLoader />
    </Suspense>
  );
}
