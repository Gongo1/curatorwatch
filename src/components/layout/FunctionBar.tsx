"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FUNCTIONS, functionForPath } from "@/lib/functions";

// The function bar: real navigation, numbered. Number keys 1–8 jump to the
// numbered functions whenever focus is not in a text field.

export function FunctionBar() {
  const pathname = usePathname();
  const router = useRouter();
  const current = functionForPath(pathname);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/changes?hours=24&limit=0")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => active && d?.success && setAlertCount(d.data.summary.total))
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const fn = FUNCTIONS.find((f) => f.key === e.key);
      if (fn) {
        e.preventDefault();
        router.push(fn.href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const numbered = FUNCTIONS.filter((f) => f.key);
  const rest = FUNCTIONS.filter((f) => !f.key);

  return (
    <nav aria-label="Functions" className="border-b border-border bg-background-subtle">
      <div className="flex items-stretch h-9 overflow-x-auto [scrollbar-width:none] max-w-[1680px] mx-auto">
        <ul className="flex items-stretch">
          {numbered.map((f) => {
            const active = current?.href === f.href;
            const badge = f.href === "/alerts" && alertCount > 0 ? alertCount : null;
            return (
              <li key={f.href} className="flex">
                <Link
                  href={f.href}
                  prefetch={false}
                  aria-current={active ? "page" : undefined}
                  aria-keyshortcuts={f.key}
                  className={`group flex items-center gap-2 px-3 border-r border-border whitespace-nowrap transition-colors duration-150 ${
                    active
                      ? "bg-accent-blue text-signal-ink"
                      : "text-text-secondary hover:bg-background-hover hover:text-text-primary"
                  }`}
                >
                  <span
                    className={`font-mono text-[0.7rem] font-bold ${
                      active ? "text-signal-ink" : "text-accent-blue"
                    }`}
                  >
                    {f.key}
                  </span>
                  <span className="cond text-[0.8rem] font-semibold uppercase tracking-[0.04em]">
                    {f.label}
                  </span>
                  {badge !== null && (
                    <span
                      className={`num text-[0.7rem] px-1 ${
                        active ? "bg-signal-ink text-accent-blue" : "bg-background-hover text-text-secondary"
                      }`}
                      aria-label={`${badge} changes in 24 hours`}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        <ul className="flex items-stretch ml-auto border-l border-border">
          {rest.map((f) => {
            const active = current?.href === f.href;
            return (
              <li key={f.href} className="flex">
                <Link
                  href={f.href}
                  prefetch={false}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center px-3 border-r border-border cond text-[0.8rem] font-semibold uppercase tracking-[0.04em] whitespace-nowrap transition-colors duration-150 ${
                    active
                      ? "bg-accent-blue text-signal-ink"
                      : "text-text-tertiary hover:bg-background-hover hover:text-text-primary"
                  }`}
                >
                  {f.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
