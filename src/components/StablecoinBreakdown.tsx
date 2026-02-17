"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils/format";

interface StablecoinData {
  symbol: string;
  amount: number;
  percentage: number;
}

// Color mapping for stablecoins
const STABLECOIN_COLORS: Record<string, string> = {
  USDC: "bg-blue-500",
  USDT: "bg-emerald-500",
  PYUSD: "bg-purple-500",
  EURC: "bg-amber-500",
  DAI: "bg-yellow-500",
  FRAX: "bg-red-500",
  WETH: "bg-indigo-500",
  wstETH: "bg-cyan-500",
  Other: "bg-gray-500",
};

const STABLECOIN_TEXT_COLORS: Record<string, string> = {
  USDC: "text-blue-400",
  USDT: "text-emerald-400",
  PYUSD: "text-purple-400",
  EURC: "text-amber-400",
  DAI: "text-yellow-400",
  FRAX: "text-red-400",
  WETH: "text-indigo-400",
  wstETH: "text-cyan-400",
  Other: "text-gray-400",
};

export function StablecoinBreakdown() {
  const [data, setData] = useState<StablecoinData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/stats/stablecoins");
        const result = await response.json();

        if (result.success) {
          setData(result.data.breakdown);
          setTotal(result.data.total);
        }
      } catch (err) {
        console.error("Failed to fetch stablecoin data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="bg-background-subtle border border-border rounded-xl p-4 h-full">
        <div className="h-5 w-40 bg-background-elevated rounded animate-pulse mb-1" />
        <div className="h-4 w-24 bg-background-elevated rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between">
                <div className="h-4 w-16 bg-background-elevated rounded animate-pulse" />
                <div className="h-4 w-20 bg-background-elevated rounded animate-pulse" />
              </div>
              <div className="h-2 bg-background-elevated rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-subtle border border-border rounded-xl p-4 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary">
          Assets Under Management
        </h3>
        <p className="text-xs text-text-tertiary">By Asset Type</p>
      </div>

      <div className="space-y-3">
        {data.map((asset) => {
          const bgColor = STABLECOIN_COLORS[asset.symbol] || STABLECOIN_COLORS.Other;
          const textColor = STABLECOIN_TEXT_COLORS[asset.symbol] || STABLECOIN_TEXT_COLORS.Other;

          return (
            <div key={asset.symbol} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${bgColor}`} />
                  <span className={`font-medium ${textColor}`}>{asset.symbol}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-text-primary font-semibold tabular-nums">
                    {formatCurrency(asset.amount)}
                  </span>
                  <span className="text-text-tertiary text-xs tabular-nums w-12 text-right">
                    {asset.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-background-elevated rounded-full overflow-hidden">
                <div
                  className={`h-full ${bgColor} rounded-full transition-all duration-500`}
                  style={{ width: `${Math.min(asset.percentage, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="mt-4 pt-3 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Total</span>
          <span className="text-lg font-bold text-text-primary tabular-nums">
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </div>
  );
}
