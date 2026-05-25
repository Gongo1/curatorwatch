"use client";

import { useState, useCallback } from "react";

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

const STORAGE_KEY = "cw-portfolio";

function loadLocalPortfolio(): Portfolio {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PORTFOLIO;
    const parsed = JSON.parse(raw);
    return {
      trackedVaults: Array.isArray(parsed.trackedVaults) ? parsed.trackedVaults : [],
      trackedCurators: Array.isArray(parsed.trackedCurators) ? parsed.trackedCurators : [],
    };
  } catch {
    return EMPTY_PORTFOLIO;
  }
}

function saveLocalPortfolio(portfolio: Portfolio) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
  } catch {
    // silent fail
  }
}

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio>(() => {
    if (typeof window === "undefined") return EMPTY_PORTFOLIO;
    return loadLocalPortfolio();
  });
  const loaded = true;

  const trackVault = useCallback((address: string, name: string) => {
    setPortfolio((prev) => {
      if (prev.trackedVaults.some((v) => v.address === address)) return prev;
      const next = { ...prev, trackedVaults: [...prev.trackedVaults, { address, name }] };
      saveLocalPortfolio(next);
      return next;
    });
  }, []);

  const untrackVault = useCallback((address: string) => {
    setPortfolio((prev) => {
      const next = { ...prev, trackedVaults: prev.trackedVaults.filter((v) => v.address !== address) };
      saveLocalPortfolio(next);
      return next;
    });
  }, []);

  const trackCurator = useCallback((id: string, name: string) => {
    setPortfolio((prev) => {
      if (prev.trackedCurators.some((c) => c.id === id)) return prev;
      const next = { ...prev, trackedCurators: [...prev.trackedCurators, { id, name }] };
      saveLocalPortfolio(next);
      return next;
    });
  }, []);

  const untrackCurator = useCallback((id: string) => {
    setPortfolio((prev) => {
      const next = { ...prev, trackedCurators: prev.trackedCurators.filter((c) => c.id !== id) };
      saveLocalPortfolio(next);
      return next;
    });
  }, []);

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
