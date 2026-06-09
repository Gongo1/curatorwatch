import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareClient } from "./compare-client";

export const metadata: Metadata = {
  title: "Compare Curators - CuratorWatch",
  description:
    "Compare DeFi vault curators side by side: AUM, track record, net APY, vault grades, fees, risk posture, and asset mix.",
};

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="h-[60vh]" />}>
      <CompareClient />
    </Suspense>
  );
}
