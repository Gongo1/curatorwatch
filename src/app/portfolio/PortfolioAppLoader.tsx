"use client";

import dynamic from "next/dynamic";

// Client-only mount for the portfolio dashboard (it uses the wallet hook).
// AppKit must never evaluate during SSR — see DepositAppLoader.
const PortfolioApp = dynamic(
  () => import("./PortfolioApp").then((m) => m.PortfolioApp),
  { ssr: false, loading: () => <div className="h-[60vh]" /> }
);

export function PortfolioAppLoader() {
  return <PortfolioApp />;
}
