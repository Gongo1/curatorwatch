"use client";

import { useCallback, useEffect, useState } from "react";

// Minimal raw window.ethereum (EIP-1193) wallet primitive — no wagmi/viem/RainbowKit.
// Mirrors Turtle's own MetaMask demo: connect, chain switch, personal_sign (SIWE),
// eth_sendTransaction. Consumed by the /deposit flow.

type RequestArgs = { method: string; params?: unknown[] | object };

interface EthereumProvider {
  request: (args: RequestArgs) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
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
  return typeof window !== "undefined" ? window.ethereum : undefined;
}

function errCode(e: unknown): number | undefined {
  return typeof e === "object" && e && "code" in e
    ? (e as { code?: number }).code
    : undefined;
}

export function useEthereum(): UseEthereum {
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
