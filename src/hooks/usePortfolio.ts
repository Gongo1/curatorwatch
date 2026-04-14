"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser, useClerk } from "@clerk/nextjs";

interface TrackedVault {
  address: string;
  name: string;
}

interface TrackedCurator {
  id: string;
  name: string;
}

interface Portfolio {
  trackedVaults: TrackedVault[];
  trackedCurators: TrackedCurator[];
}

const EMPTY_PORTFOLIO: Portfolio = {
  trackedVaults: [],
  trackedCurators: [],
};

interface UsePortfolioOptions {
  onUnauthenticated?: () => void;
}

export function usePortfolio(options?: UsePortfolioOptions) {
  const { user, isLoaded } = useUser();
  const clerk = useClerk();
  const [portfolio, setPortfolio] = useState<Portfolio>(EMPTY_PORTFOLIO);
  const [loaded, setLoaded] = useState(false);

  // Fetch tracked items from DB when signed in
  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setPortfolio(EMPTY_PORTFOLIO);
      setLoaded(true);
      return;
    }

    let cancelled = false;

    async function fetchTracked() {
      try {
        const [vaultRes, curatorRes] = await Promise.all([
          fetch("/api/track-vault"),
          fetch("/api/track-curator"),
        ]);

        if (cancelled) return;

        const vaultData = await vaultRes.json();
        const curatorData = await curatorRes.json();

        setPortfolio({
          trackedVaults: (vaultData.addresses ?? []).map((addr: string) => ({
            address: addr,
            name: addr, // Name resolved by consuming component
          })),
          trackedCurators: (curatorData.addresses ?? []).map((addr: string) => ({
            id: addr,
            name: addr, // Name resolved by consuming component
          })),
        });
      } catch {
        // Silent fail — keep empty portfolio
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    fetchTracked();
    return () => { cancelled = true; };
  }, [user, isLoaded]);

  const trackVault = useCallback(
    (address: string, name: string) => {
      if (!user) {
        if (options?.onUnauthenticated) {
          options.onUnauthenticated();
        } else {
          clerk.openSignIn();
        }
        return;
      }

      // Optimistic update
      setPortfolio((prev) => {
        if (prev.trackedVaults.some((v) => v.address === address)) return prev;
        return { ...prev, trackedVaults: [...prev.trackedVaults, { address, name }] };
      });

      // Sync to DB
      fetch("/api/track-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultAddress: address }),
      }).catch(() => {
        // Rollback on failure
        setPortfolio((prev) => ({
          ...prev,
          trackedVaults: prev.trackedVaults.filter((v) => v.address !== address),
        }));
      });
    },
    [user, clerk, options?.onUnauthenticated]
  );

  const untrackVault = useCallback(
    (address: string) => {
      if (!user) return;

      // Optimistic update
      setPortfolio((prev) => ({
        ...prev,
        trackedVaults: prev.trackedVaults.filter((v) => v.address !== address),
      }));

      // Sync to DB
      fetch("/api/track-vault", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultAddress: address }),
      }).catch(() => {
        // Refetch on failure to restore state
        fetch("/api/track-vault")
          .then((r) => r.json())
          .then((data) => {
            setPortfolio((prev) => ({
              ...prev,
              trackedVaults: (data.addresses ?? []).map((addr: string) => ({
                address: addr,
                name: addr,
              })),
            }));
          })
          .catch(() => {});
      });
    },
    [user]
  );

  const trackCurator = useCallback(
    (id: string, name: string) => {
      if (!user) {
        if (options?.onUnauthenticated) {
          options.onUnauthenticated();
        } else {
          clerk.openSignIn();
        }
        return;
      }

      // Optimistic update
      setPortfolio((prev) => {
        if (prev.trackedCurators.some((c) => c.id === id)) return prev;
        return { ...prev, trackedCurators: [...prev.trackedCurators, { id, name }] };
      });

      // Sync to DB
      fetch("/api/track-curator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curatorAddress: id }),
      }).catch(() => {
        // Rollback on failure
        setPortfolio((prev) => ({
          ...prev,
          trackedCurators: prev.trackedCurators.filter((c) => c.id !== id),
        }));
      });
    },
    [user, clerk, options?.onUnauthenticated]
  );

  const untrackCurator = useCallback(
    (id: string) => {
      if (!user) return;

      // Optimistic update
      setPortfolio((prev) => ({
        ...prev,
        trackedCurators: prev.trackedCurators.filter((c) => c.id !== id),
      }));

      // Sync to DB
      fetch("/api/track-curator", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curatorAddress: id }),
      }).catch(() => {
        // Refetch on failure to restore state
        fetch("/api/track-curator")
          .then((r) => r.json())
          .then((data) => {
            setPortfolio((prev) => ({
              ...prev,
              trackedCurators: (data.addresses ?? []).map((addr: string) => ({
                id: addr,
                name: addr,
              })),
            }));
          })
          .catch(() => {});
      });
    },
    [user]
  );

  const isVaultTracked = useCallback(
    (address: string) => portfolio.trackedVaults.some((v) => v.address === address),
    [portfolio.trackedVaults]
  );

  const isCuratorTracked = useCallback(
    (id: string) => portfolio.trackedCurators.some((c) => c.id === id),
    [portfolio.trackedCurators]
  );

  const hasTrackedItems =
    portfolio.trackedVaults.length > 0 || portfolio.trackedCurators.length > 0;

  return {
    portfolio,
    trackVault,
    untrackVault,
    trackCurator,
    untrackCurator,
    isVaultTracked,
    isCuratorTracked,
    hasTrackedItems,
    loaded,
  };
}
