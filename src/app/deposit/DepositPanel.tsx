"use client";

import { useState } from "react";
import {
  createDeposit,
  verifyDeposit,
  isAttributedToUs,
  toBaseUnits,
  chainId as tokenChainId,
  chainLabel,
  explorerTxUrl,
  type EarnOpportunity,
  type VerifyResult,
} from "@/lib/turtle/earn-client";
import { chainName, type UseEthereum } from "@/lib/turtle/useEthereum";

type Phase =
  | "input"
  | "switching"
  | "quoting"
  | "sending"
  | "verifying"
  | "done"
  | "error";

/** Decimal string -> 0x hex quantity for eth_sendTransaction. */
function toHexQ(v?: string): string | undefined {
  if (v == null || v === "") return undefined;
  if (v.startsWith("0x")) return v;
  try {
    return "0x" + BigInt(v).toString(16);
  } catch {
    return undefined;
  }
}

export function DepositPanel({
  opportunity: o,
  wallet,
  member,
  onDeposited,
}: {
  opportunity: EarnOpportunity;
  wallet: UseEthereum;
  member: boolean | null;
  onDeposited?: (hash: string) => void;
}) {
  const token = o.depositTokens?.[0];
  const cid = tokenChainId(token);
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [step, setStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [finalHash, setFinalHash] = useState<string | null>(null);
  const [verify, setVerify] = useState<VerifyResult | null>(null);

  const busy =
    phase === "switching" ||
    phase === "quoting" ||
    phase === "sending" ||
    phase === "verifying";

  const canDeposit =
    !!wallet.account && member === true && !!token && !!cid && !busy;

  async function run() {
    setError(null);
    if (!token) return setError("This opportunity has no deposit token.");
    if (!wallet.account) return setError("Connect a wallet first.");
    if (!cid) return setError("Unknown chain for this opportunity.");

    let amt: string;
    try {
      amt = toBaseUnits(amount, token.decimals);
    } catch (e) {
      return setError(e instanceof Error ? e.message : "Invalid amount");
    }
    if (BigInt(amt) <= 0n) return setError("Enter an amount greater than 0.");

    try {
      if (wallet.chainId !== cid) {
        setPhase("switching");
        setStep(`Switch wallet to ${chainName(cid)}…`);
        await wallet.switchChain(cid);
      }

      setPhase("quoting");
      setStep("Building deposit transactions…");
      const quote = await createDeposit({
        opportunityId: o.id,
        userAddress: wallet.account,
        tokenIn: token.address,
        amount: amt,
        mode: o.swapDirectEnabled ? "direct" : "swap",
      });
      const txs = quote.transactions ?? [];
      if (!txs.length) throw new Error("No transactions returned by the API.");

      setPhase("sending");
      let last = "";
      for (let i = 0; i < txs.length; i++) {
        const t = txs[i].transaction;
        setStep(
          `Confirm in wallet: ${
            txs[i].description || txs[i].type || `transaction ${i + 1}`
          } (${i + 1}/${txs.length})`
        );
        // Sequential awaits => increasing nonces => approval mines before deposit.
        last = await wallet.sendTransaction({
          from: wallet.account,
          to: t.to,
          data: t.data,
          value: toHexQ(t.value) ?? "0x0",
          gas: toHexQ(t.gasLimit),
        });
      }
      setFinalHash(last);

      setPhase("verifying");
      setStep("Verifying attribution…");
      try {
        setVerify(await verifyDeposit(cid, last));
      } catch {
        // Verification can lag the tx landing on-chain; not fatal to the deposit.
        setVerify(null);
      }
      setPhase("done");
      onDeposited?.(last);
    } catch (e) {
      const code = (e as { code?: number })?.code;
      setError(
        code === 4001
          ? "Request rejected in wallet."
          : e instanceof Error
            ? e.message
            : "Deposit failed"
      );
      setPhase("error");
    }
  }

  const txUrl = finalHash ? explorerTxUrl(token, finalHash) : undefined;
  const attributed = verify ? isAttributedToUs(verify) : false;

  return (
    <div className="mt-2 mb-2 p-4 bg-background-subtle border border-border rounded-xl">
      {phase !== "done" && (
        <>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs text-text-tertiary mb-1">
                Amount ({token?.symbol ?? "token"}
                {chainLabel(token) ? ` · ${chainLabel(token)}` : ""})
              </label>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                disabled={busy}
                className="w-full bg-background-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary font-mono outline-none focus:border-cyan-500/50 disabled:opacity-50"
              />
            </div>
            <button
              onClick={run}
              disabled={!canDeposit || !amount}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-cyan-500 text-[#06120f] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? "Working…" : "Deposit"}
            </button>
          </div>

          {member !== true && wallet.account && (
            <p className="mt-2 text-xs text-text-tertiary">
              Join Turtle (in the bar above) before depositing.
            </p>
          )}
          {busy && (
            <p className="mt-3 text-sm text-text-secondary flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" />
              {step}
            </p>
          )}
          {error && (
            <p className="mt-3 text-sm text-accent-red">{error}</p>
          )}
        </>
      )}

      {phase === "done" && (
        <div className="space-y-2">
          <div
            className={`text-sm font-medium ${
              attributed ? "text-cyan-500" : "text-text-primary"
            }`}
          >
            {attributed
              ? "✓ Deposit attributed to CuratorWatch"
              : "Deposit submitted"}
          </div>
          {verify && (
            <div className="text-xs text-text-secondary font-mono">
              signatureValid: {String(verify.signatureValid)} · distributorId:{" "}
              {verify.metadata?.distributorId ?? "—"}
            </div>
          )}
          {!verify && (
            <div className="text-xs text-text-tertiary">
              Attribution not confirmed yet — verification can lag the tx landing
              on-chain. Check the Track view shortly.
            </div>
          )}
          {finalHash && (
            <div className="text-xs text-text-tertiary font-mono break-all">
              tx: {txUrl ? (
                <a
                  href={txUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-500 hover:underline"
                >
                  {finalHash}
                </a>
              ) : (
                finalHash
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
