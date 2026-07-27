"use client";

import dynamic from "next/dynamic";

// Client-only mount for the deposit flow. AppKit (and its Coinbase/WalletConnect
// connectors) must never evaluate during SSR — the Coinbase SDK's server build
// pulls optional deps that break the SSR bundle. Mirrors DealDepositDrawer's
// ssr:false pattern.
const DepositApp = dynamic(
  () => import("./DepositApp").then((m) => m.DepositApp),
  { ssr: false, loading: () => <div className="h-[60vh]" /> }
);

export function DepositAppLoader() {
  return <DepositApp />;
}
