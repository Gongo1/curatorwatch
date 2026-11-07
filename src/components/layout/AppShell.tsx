"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X } from "lucide-react";
import { CommandLine } from "./CommandLine";
import { FunctionBar } from "./FunctionBar";
import { Footer } from "./Footer";
import { AccountCTA } from "@/components/gate/AccountCTA";

interface AppShellProps {
  children: React.ReactNode;
}

/** UTC clock, minute resolution. Renders after mount (no hydration drift). */
function UtcClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className="w-[4.5rem]" aria-hidden="true" />;
  return (
    <time dateTime={now.toISOString()} className="num text-xs text-text-secondary whitespace-nowrap">
      {now.toISOString().slice(11, 16)} <span className="text-text-muted">UTC</span>
    </time>
  );
}

export function AppShell({ children }: AppShellProps) {
  const [mobileCmd, setMobileCmd] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-40">
        <div className="border-b border-border bg-background">
          <div className="flex items-center gap-3 h-11 px-3 max-w-[1680px] mx-auto">
            <Link href="/" className="flex items-center gap-2 flex-none" aria-label="CuratorWatch home">
              <Image src="/logo.png" alt="" width={22} height={22} className="flex-none" priority />
              <span className="cond text-[0.95rem] font-extrabold uppercase tracking-[0.06em] text-text-primary">
                Curator<span className="text-accent-blue">Watch</span>
              </span>
            </Link>

            <div className="hidden md:block flex-1 max-w-[34rem] ml-4">
              <CommandLine />
            </div>

            <div className="ml-auto flex items-center gap-3">
              <span className="hidden lg:flex items-center gap-1.5 label">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green" aria-hidden="true" />
                Live · 6h refresh
              </span>
              <span className="hidden sm:block">
                <UtcClock />
              </span>
              <button
                type="button"
                onClick={() => setMobileCmd((v) => !v)}
                aria-label={mobileCmd ? "Close command line" : "Open command line"}
                aria-expanded={mobileCmd}
                className="md:hidden grid place-items-center w-8 h-8 border border-border-strong text-text-secondary hover:text-accent-blue"
              >
                {mobileCmd ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              </button>
              <AccountCTA />
            </div>
          </div>
          {mobileCmd && (
            <div className="md:hidden px-3 pb-2.5">
              <CommandLine autoFocus onDone={() => setMobileCmd(false)} />
            </div>
          )}
        </div>
        <FunctionBar />
      </header>

      <main className="flex-1 w-full max-w-[1680px] mx-auto px-3 py-3">{children}</main>

      <Footer />
    </div>
  );
}
