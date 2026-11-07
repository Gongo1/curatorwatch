"use client";

import { useState, useEffect } from "react";

interface PendingConfig {
  validAt: number;
  functionName: string;
  txHash: string;
}

const FUNCTION_LABELS: Record<string, string> = {
  SetCap: "Set Market Cap",
  SetIsAllocator: "Set Allocator",
  SetGuardian: "Set Guardian",
  SetFee: "Set Performance Fee",
  SetFeeRecipient: "Set Fee Recipient",
  SetSupplyQueue: "Set Supply Queue",
  SetWithdrawQueue: "Set Withdraw Queue",
  SetTimelock: "Set Timelock",
  SetSkimRecipient: "Set Skim Recipient",
  SetOwner: "Transfer Ownership",
  SetCurator: "Set Curator",
  ReallocateIdle: "Reallocate Idle",
  ReallocateSupply: "Reallocate Supply",
  ReallocateWithdraw: "Reallocate Withdraw",
  SubmitCap: "Submit Cap Change",
  SubmitGuardian: "Submit Guardian Change",
  SubmitTimelock: "Submit Timelock Change",
  SubmitFee: "Submit Fee Change",
};

function formatCountdown(validAtSeconds: number): string {
  const nowMs = Date.now();
  const validAtMs = validAtSeconds * 1000;
  const diffMs = validAtMs - nowMs;

  if (diffMs <= 0) return "Executable now";

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d ${hours}h remaining`;
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m remaining`;
}

function getLabel(functionName: string): string {
  return FUNCTION_LABELS[functionName] || functionName.replace(/([A-Z])/g, " $1").trim();
}

export function PendingConfigBanner({ configs }: { configs?: PendingConfig[] }) {
  const [, setTick] = useState(0);

  // Update countdown every minute
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!configs || configs.length === 0) return null;

  return (
    <section aria-label="Pending governance change" className="panel border-accent-yellow-muted">
      <div className="panel-head">
        <svg className="w-3.5 h-3.5 text-accent-yellow flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="panel-title text-accent-yellow">Pending governance change</h2>
        <span className="panel-meta">{configs.length} queued</span>
      </div>
      <ul>
        {configs.map((config, i) => (
          <li key={`${config.txHash}-${i}`} className="flex items-center justify-between gap-3 px-3 h-8 border-b border-border-subtle last:border-b-0 text-sm">
            <span className="text-text-primary font-medium truncate">{getLabel(config.functionName)}</span>
            <span className={`num text-xs flex-none ${
              config.validAt * 1000 <= Date.now() ? "text-accent-green" : "text-accent-yellow"
            }`}>
              {formatCountdown(config.validAt)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
