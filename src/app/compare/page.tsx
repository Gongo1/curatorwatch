import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareClient } from "./compare-client";

export const metadata: Metadata = {
  title: "Compare Curators - CuratorWatch",
  description:
    "Compare DeFi vault curators side by side: AUM, net APY, per-vault APY spread, estimated yield, strategy, asset mix, networks, and entity.",
};

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="h-[60vh]" />}>
      <CompareClient />
    </Suspense>
  );
}
