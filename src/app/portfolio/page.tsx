import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PortfolioAppLoader } from "./PortfolioAppLoader";

export const metadata = {
  title: "Portfolio | CuratorWatch",
  description:
    "Connect a wallet or paste an address to see your DeFi positions, the curators behind them, and their CuratorWatch risk grades.",
};

// Feature-flagged via NEXT_PUBLIC_FEATURE_PORTFOLIO (mirrors /deposit). 404s until
// the flag is "true", so it ships dark. PortfolioApp reads ?address= for shareable
// links, hence the Suspense boundary around useSearchParams.
export default function PortfolioPage() {
  if (process.env.NEXT_PUBLIC_FEATURE_PORTFOLIO !== "true") {
    notFound();
  }
  return (
    <Suspense fallback={<div className="h-[60vh]" />}>
      <PortfolioAppLoader />
    </Suspense>
  );
}
