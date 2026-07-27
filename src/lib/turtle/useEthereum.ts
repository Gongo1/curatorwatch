"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useAppKitAccount,
  useAppKitNetwork,
  useAppKitProvider,
} from "@reown/appkit/react";
import {
  REOWN_ENABLED,
  ensureAppKit,
  networkById,
  openConnectModal,
} from "./appkit";

// Wallet primitive consumed by the /deposit flow (connect, chain switch,
// personal_sign for SIWE, eth_sendTransaction). Two implementations behind one
// interface:
// - Reown AppKit (when NEXT_PUBLIC_REOWN_PROJECT_ID is set): connect modal with
//   injected wallets + WalletConnect QR/deep-link (mobile, Safe) + Coinbase.
// - Legacy raw window.ethereum (EIP-1193, injected only): the pre-Reown path,
//   kept as the fallback so the flow still works before the env var lands.
// The switch is build-time constant (NEXT_PUBLIC_ inlining), so hook order is
// stable and consumers never know which one they got.

type RequestArgs = { method: string; params?: unknown[] | object };

interface EthereumProvider {
  request: (args: RequestArgs) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
}

export interface TxRequest {
  to: string;
  data?: string;
  value?: string;
  from?: string;
  gas?: string;
}

export interface UseEthereum {
  available: boolean;
  account: string | null;
  chainId: number | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<string | null>;
  switchChain: (target: number) => Promise<void>;
  personalSign: (message: string, address: string) => Promise<string>;
  sendTransaction: (tx: TxRequest) => Promise<string>;
}

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  56: "BSC",
  100: "Gnosis",
  137: "Polygon",
  143: "Monad",
  146: "Sonic",
  8453: "Base",
  42161: "Arbitrum",
  43114: "Avalanche",
  59144: "Linea",
  534352: "Scroll",
  11155111: "Sepolia",
};

export function chainName(id: number | null | undefined): string {
  if (id == null) return "—";
  return CHAIN_NAMES[id] ?? `Chain ${id}`;
}

function getProvider(): EthereumProvider | undefined {
  // AppKit declares window.ethereum as Record<string, unknown>; narrow it here.
  return typeof window !== "undefined"
    ? (window.ethereum as unknown as EthereumProvider | undefined)
    : undefined;
}

function errCode(e: unknown): number | undefined {
  return typeof e === "object" && e && "code" in e
    ? (e as { code?: number }).code
    : undefined;
}

function rejectionMessage(e: unknown, fallback: string): string {
  return errCode(e) === 4001
    ? "Request rejected in wallet."
    : ((e as Error)?.message ?? fallback);
}

// ── Reown AppKit implementation ─────────────────────────────────────────────

// Module scope: AppKit must be created before its hooks first render. Only
// client components import this module, so this runs exactly once per bundle.
ensureAppKit();

function useEthereumAppKit(): UseEthereum {
  const { address, status } = useAppKitAccount();
  const { chainId: rawChainId, switchNetwork } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider<EthereumProvider>("eip155");
  const [error, setError] = useState<string | null>(null);

  const chainId =
    typeof rawChainId === "number"
      ? rawChainId
      : typeof rawChainId === "string"
        ? parseInt(rawChainId, 10) || null
        : null;

  // AppKit's modal owns the connect UX (wallet list, QR, errors); resolves with
  // the address once the user finishes, null if they dismiss the modal.
  const connect = useCallback(async () => {
    setError(null);
    return openConnectModal();
  }, []);

  const switchChain = useCallback(
    async (target: number) => {
      setError(null);
      const network = networkById.get(target);
      try {
        if (network) {
          await switchNetwork(network);
        } else if (walletProvider) {
          // Chain outside AppKit's catalog (e.g. Monad) — raw EIP-3326 request.
          await walletProvider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x" + target.toString(16) }],
          });
        } else {
          throw new Error("No wallet connected");
        }
      } catch (e) {
        setError(rejectionMessage(e, "Failed to switch network"));
        throw e;
      }
    },
    [switchNetwork, walletProvider]
  );

  const personalSign = useCallback(
    async (message: string, address_: string) => {
      if (!walletProvider) throw new Error("No wallet connected");
      const sig = await walletProvider.request({
        method: "personal_sign",
        params: [message, address_],
      });
      return String(sig);
    },
    [walletProvider]
  );

  const sendTransaction = useCallback(
    async (tx: TxRequest) => {
      if (!walletProvider) throw new Error("No wallet connected");
      const hash = await walletProvider.request({
        method: "eth_sendTransaction",
        params: [tx],
      });
      return String(hash);
    },
    [walletProvider]
  );

  return {
    // The modal's WalletConnect QR works without any installed extension, so a
    // wallet is always reachable.
    available: true,
    account: address ?? null,
    chainId,
    connecting: status === "connecting" || status === "reconnecting",
    error,
    connect,
    switchChain,
    personalSign,
    sendTransaction,
  };
}

// ── Legacy injected-wallet implementation (pre-Reown fallback) ──────────────

function useEthereumInjected(): UseEthereum {
  const [available, setAvailable] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const provider = getProvider();
    if (!provider) {
      setAvailable(false);
      return;
    }
    setAvailable(true);

    let active = true;
    // Silent detection of an already-connected wallet (no prompt).
    provider
      .request({ method: "eth_accounts" })
      .then((accts) => {
        if (active && Array.isArray(accts) && accts.length) {
          setAccount(String(accts[0]));
        }
      })
      .catch(() => {});
    provider
      .request({ method: "eth_chainId" })
      .then((id) => {
        if (active && typeof id === "string") setChainId(parseInt(id, 16));
      })
      .catch(() => {});

    const onAccounts = (...args: unknown[]) => {
      const accts = args[0];
      setAccount(
        Array.isArray(accts) && accts.length ? String(accts[0]) : null
      );
    };
    const onChain = (...args: unknown[]) => {
      const id = args[0];
      if (typeof id === "string") setChainId(parseInt(id, 16));
    };
    provider.on?.("accountsChanged", onAccounts);
    provider.on?.("chainChanged", onChain);

    return () => {
      active = false;
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setError("No Ethereum wallet found. Install MetaMask to continue.");
      return null;
    }
    setConnecting(true);
    setError(null);
    try {
      const accts = await provider.request({ method: "eth_requestAccounts" });
      const addr =
        Array.isArray(accts) && accts.length ? String(accts[0]) : null;
      setAccount(addr);
      const id = await provider.request({ method: "eth_chainId" });
      if (typeof id === "string") setChainId(parseInt(id, 16));
      return addr;
    } catch (e) {
      setError(
        errCode(e) === 4001
          ? "Connection request rejected."
          : ((e as Error)?.message ?? "Failed to connect wallet")
      );
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const switchChain = useCallback(async (target: number) => {
    const provider = getProvider();
    if (!provider) throw new Error("No Ethereum wallet found");
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x" + target.toString(16) }],
    });
    setChainId(target);
  }, []);

  const personalSign = useCallback(
    async (message: string, address: string) => {
      const provider = getProvider();
      if (!provider) throw new Error("No Ethereum wallet found");
      const sig = await provider.request({
        method: "personal_sign",
        params: [message, address],
      });
      return String(sig);
    },
    []
  );

  const sendTransaction = useCallback(async (tx: TxRequest) => {
    const provider = getProvider();
    if (!provider) throw new Error("No Ethereum wallet found");
    const hash = await provider.request({
      method: "eth_sendTransaction",
      params: [tx],
    });
    return String(hash);
  }, []);

  return {
    available,
    account,
    chainId,
    connecting,
    error,
    connect,
    switchChain,
    personalSign,
    sendTransaction,
  };
}

// Build-time constant switch — NEXT_PUBLIC_ vars are inlined, so this never
// changes at runtime and the rules of hooks hold.
export const useEthereum: () => UseEthereum = REOWN_ENABLED
  ? useEthereumAppKit
  : useEthereumInjected;
