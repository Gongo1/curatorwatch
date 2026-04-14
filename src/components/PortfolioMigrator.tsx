"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

const STORAGE_KEY = "cw-portfolio";

interface LocalPortfolio {
  trackedVaults?: { address: string; name: string }[];
  trackedCurators?: { id: string; name: string }[];
}

export function PortfolioMigrator() {
  const { user, isLoaded } = useUser();
  const [show, setShow] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [localData, setLocalData] = useState<LocalPortfolio | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed: LocalPortfolio = JSON.parse(raw);
      const hasVaults = Array.isArray(parsed.trackedVaults) && parsed.trackedVaults.length > 0;
      const hasCurators = Array.isArray(parsed.trackedCurators) && parsed.trackedCurators.length > 0;

      if (hasVaults || hasCurators) {
        setLocalData(parsed);
        setShow(true);
      }
    } catch {
      // Invalid localStorage data, ignore
    }
  }, [user, isLoaded]);

  const handleImport = async () => {
    if (!localData) return;
    setMigrating(true);

    try {
      const promises: Promise<Response>[] = [];

      for (const vault of localData.trackedVaults ?? []) {
        promises.push(
          fetch("/api/track-vault", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vaultAddress: vault.address }),
          })
        );
      }

      for (const curator of localData.trackedCurators ?? []) {
        promises.push(
          fetch("/api/track-curator", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ curatorAddress: curator.id }),
          })
        );
      }

      await Promise.all(promises);
      localStorage.removeItem(STORAGE_KEY);
      setShow(false);

      // Reload to refetch portfolio from DB
      window.location.reload();
    } catch {
      // Keep banner visible on failure
      setMigrating(false);
    }
  };

  const handleDismiss = () => {
    localStorage.removeItem(STORAGE_KEY);
    setShow(false);
  };

  if (!show) return null;

  const vaultCount = localData?.trackedVaults?.length ?? 0;
  const curatorCount = localData?.trackedCurators?.length ?? 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-background-elevated border border-border rounded-lg shadow-lg p-4">
      <p className="text-sm font-medium text-text-primary">
        Import tracked items?
      </p>
      <p className="text-xs text-text-tertiary mt-1">
        Found {vaultCount} vault{vaultCount !== 1 ? "s" : ""} and{" "}
        {curatorCount} curator{curatorCount !== 1 ? "s" : ""} saved locally.
        Import them to your account?
      </p>
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={handleImport}
          disabled={migrating}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-accent-blue text-white hover:bg-accent-blue-hover transition-colors disabled:opacity-50"
        >
          {migrating ? "Importing..." : "Import"}
        </button>
        <button
          onClick={handleDismiss}
          disabled={migrating}
          className="px-3 py-1.5 text-sm font-medium rounded-lg text-text-secondary hover:text-text-primary hover:bg-background-hover transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
