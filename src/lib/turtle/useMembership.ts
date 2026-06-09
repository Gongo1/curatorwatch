"use client";

import { useCallback, useEffect, useState } from "react";
import {
  checkMembership,
  getMembershipAgreement,
  registerMembership,
} from "./earn-client";
import type { UseEthereum } from "./useEthereum";

export interface UseTurtleMembership {
  /** true / false once checked; null while unknown or no wallet connected. */
  member: boolean | null;
  joining: boolean;
  /** Join/sign error or registration message, when something went wrong. */
  message: string | null;
  join: () => Promise<void>;
}

/**
 * Turtle membership state for the connected wallet: auto-checks on account
 * change, exposes the SIWE join flow. Shared by /deposit and the deal drawer.
 */
export function useTurtleMembership(wallet: UseEthereum): UseTurtleMembership {
  const [member, setMember] = useState<boolean | null>(null);
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet.account) {
      setMember(null);
      return;
    }
    let active = true;
    setMessage(null);
    checkMembership(wallet.account)
      .then((r) => {
        if (active) setMember(r.isMember);
      })
      .catch(() => {
        if (active) setMember(null);
      });
    return () => {
      active = false;
    };
  }, [wallet.account]);

  const join = useCallback(async () => {
    if (!wallet.account) return;
    setJoining(true);
    setMessage(null);
    try {
      const { message: agreement, nonce } = await getMembershipAgreement(
        wallet.account,
        window.location.origin
      );
      const signature = await wallet.personalSign(agreement, wallet.account);
      const res = await registerMembership({
        address: wallet.account,
        nonce,
        signature,
      });
      if (res.isMember) {
        setMember(true);
      } else {
        setMessage(res.error || "Registration did not complete.");
      }
    } catch (e) {
      const code = (e as { code?: number })?.code;
      setMessage(
        code === 4001
          ? "Signature rejected."
          : e instanceof Error
            ? e.message
            : "Failed to join Turtle"
      );
    } finally {
      setJoining(false);
    }
  }, [wallet]);

  return { member, joining, message, join };
}
