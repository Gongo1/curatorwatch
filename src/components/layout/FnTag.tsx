"use client";

import { usePathname } from "next/navigation";
import { codeForPath } from "@/lib/functions";

/** The current page's function mnemonic (CMP, YLD, CUR…) as an amber tag. */
export function FnTag({ code }: { code?: string }) {
  const pathname = usePathname();
  const c = code ?? codeForPath(pathname);
  if (!c) return null;
  return <span className="fn-tag flex-none">{c}</span>;
}
