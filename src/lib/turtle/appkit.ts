"use client";

import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import {
  mainnet,
  optimism,
  bsc,
  gnosis,
  polygon,
  sonic,
  base,
  arbitrum,
  avalanche,
  linea,
  scroll,
  sepolia,
  type AppKitNetwork,
} from "@reown/appkit/networks";

// Reown AppKit (formerly WalletConnect) wallet-connect modal. Gives the deposit
// flow injected wallets + WalletConnect QR/deep-link (mobile, Safe multisig) +
// Coinbase Wallet, replacing the injected-only window.ethereum primitive.
// The project ID (dashboard.reown.com) is a publishable client-side value — it
// ships in the JS bundle either way — so it's baked in as the default. The env
// var remains an override: set it to rotate the ID without a code change, or to
// "" to force the legacy injected-wallet fallback in useEthereum.ts.

export const REOWN_PROJECT_ID =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "8f4b44e986a882d63192a1acefd13d3d";
export const REOWN_ENABLED = REOWN_PROJECT_ID.length > 0;

// Chains Turtle deals span (mirrors CHAIN_NAMES in useEthereum). Monad isn't in
// AppKit's network catalog yet — switchChain falls back to a raw
// wallet_switchEthereumChain request for chains outside this list.
const NETWORKS = [
  mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
  avalanche,
  bsc,
  gnosis,
  sonic,
  linea,
  scroll,
  sepolia,
] as [AppKitNetwork, ...AppKitNetwork[]];

export const networkById = new Map<number, AppKitNetwork>(
  NETWORKS.map((n) => [Number(n.id), n])
);

let appKit: ReturnType<typeof createAppKit> | undefined;

/** Idempotent; must run before AppKit hooks first render. The whole wallet UI
 *  is mounted client-only (PortfolioAppLoader's dynamic ssr:false), so this
 *  module never evaluates during SSR — AppKit's Coinbase connector pulls
 *  server-only deps that break the SSR bundle. */
export function ensureAppKit(): void {
  if (appKit || !REOWN_ENABLED) return;
  appKit = createAppKit({
    adapters: [new EthersAdapter()],
    networks: NETWORKS,
    projectId: REOWN_PROJECT_ID,
    metadata: {
      name: "CuratorWatch",
      description: "DeFi vault intelligence for institutional allocators",
      url: "https://curatorwatch.com",
      icons: ["https://curatorwatch.com/logo.png"],
    },
    features: {
      analytics: false,
      email: false,
      socials: false,
    },
  });
}

/** Open the connect modal and resolve with the connected address, or null when
 *  the user closes the modal without connecting. Matches the legacy
 *  connect() contract (`wallet.account ?? await wallet.connect()`). */
export async function openConnectModal(): Promise<string | null> {
  if (!appKit) return null;
  const existing = appKit.getAddress("eip155");
  if (existing) return existing;
  await appKit.open({ view: "Connect" });
  return new Promise((resolve) => {
    const unsubs: Array<() => void> = [];
    const done = (v: string | null) => {
      unsubs.forEach((u) => u());
      resolve(v);
    };
    unsubs.push(
      appKit!.subscribeAccount((acc) => {
        if (acc.isConnected && acc.address) done(acc.address);
      }, "eip155")
    );
    // Modal dismissed (also fires on successful connect, where the address is
    // set by then — either path resolves correctly).
    unsubs.push(
      appKit!.subscribeState((s) => {
        if (!s.open) done(appKit!.getAddress("eip155") ?? null);
      })
    );
  });
}
