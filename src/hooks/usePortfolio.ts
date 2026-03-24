"use client";

import { useState, useEffect, useCallback } from "react";

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

const STORAGE_KEY = "cw-portfolio";

const EMPTY_PORTFOLIO: Portfolio = {
  trackedVaults: [],
  trackedCurators: [],
};

function readPortfolio(): Portfolio {
  if (typeof window === "undefined") return EMPTY_PORTFOLIO;
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

function writePortfolio(portfolio: Portfolio) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
}

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio>(EMPTY_PORTFOLIO);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setPortfolio(readPortfolio());
  }, []);

  // Sync across tabs
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setPortfolio(readPortfolio());
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const trackVault = useCallback((address: string, name: string) => {
    setPortfolio((prev) => {
      if (prev.trackedVaults.some((v) => v.address === address)) return prev;
      const next = { ...prev, trackedVaults: [...prev.trackedVaults, { address, name }] };
      writePortfolio(next);
      return next;
    });
  }, []);

  const untrackVault = useCallback((address: string) => {
    setPortfolio((prev) => {
      const next = { ...prev, trackedVaults: prev.trackedVaults.filter((v) => v.address !== address) };
      writePortfolio(next);
      return next;
    });
  }, []);

  const trackCurator = useCallback((id: string, name: string) => {
    setPortfolio((prev) => {
      if (prev.trackedCurators.some((c) => c.id === id)) return prev;
      const next = { ...prev, trackedCurators: [...prev.trackedCurators, { id, name }] };
      writePortfolio(next);
      return next;
    });
  }, []);

  const untrackCurator = useCallback((id: string) => {
    setPortfolio((prev) => {
      const next = { ...prev, trackedCurators: prev.trackedCurators.filter((c) => c.id !== id) };
      writePortfolio(next);
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
  };
}
