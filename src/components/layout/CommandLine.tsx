"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FUNCTIONS } from "@/lib/functions";
import { curatorSlug } from "@/lib/curator-aliases";
import { useGate } from "@/lib/gate/GateProvider";

// The command line: type a function code (CMP, YLD…), a page name, or a
// curator name, then Enter or GO. "/" or ⌘K focuses it from anywhere.
// Curator names load on first focus for viewers allowed to open profiles;
// anonymous viewers get functions plus a sign-up row for curator search.

interface CuratorHit {
  name: string;
  href: string;
  aum: number;
}

type Result =
  | { kind: "fn"; id: string; code: string; label: string; href: string }
  | { kind: "curator"; id: string; label: string; href: string; aum: number }
  | { kind: "gate"; id: string; label: string }
  | { kind: "loading"; id: string; label: string }
  | { kind: "error"; id: string; label: string };

let curatorCache: Promise<CuratorHit[]> | null = null;

function loadCurators(): Promise<CuratorHit[]> {
  if (!curatorCache) {
    curatorCache = fetch("/api/curators?page=1&pageSize=100&sortBy=aum&sortOrder=desc")
      .then((r) => {
        if (!r.ok) throw new Error(`curators ${r.status}`);
        return r.json();
      })
      .then((j) => {
        const list = j?.data?.curators;
        if (!Array.isArray(list)) throw new Error("curators: bad payload");
        return list
          .filter((c: { name?: string | null }) => !!c.name)
          .map((c: { name: string; curatorAddress: string; totalAUM: number }) => ({
            name: c.name,
            href: `/curator/${curatorSlug(c.name, c.curatorAddress)}`,
            aum: c.totalAUM,
          }));
      })
      .catch((e) => {
        curatorCache = null; // retry on the next focus
        throw e;
      });
  }
  return curatorCache;
}

function compactUsd(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return `${Math.round(n / 1e3)}K`;
}

export function CommandLine({
  autoFocus = false,
  onDone,
}: {
  autoFocus?: boolean;
  /** Called after a navigation (mobile closes its command row). */
  onDone?: () => void;
}) {
  const router = useRouter();
  const { enabled: gateOn, isSignedIn, openGate } = useGate();
  const canSearchCurators = !gateOn || isSignedIn;
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [curators, setCurators] = useState<CuratorHit[]>([]);
  const [loadingCurators, setLoadingCurators] = useState(false);
  const [curatorsFailed, setCuratorsFailed] = useState(false);

  // "/" and ⌘K / Ctrl+K focus the command line from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load curator names on first focus or first keystroke, whichever comes first.
  const ensureCurators = useCallback(() => {
    if (canSearchCurators && curators.length === 0 && !loadingCurators) {
      setLoadingCurators(true);
      setCuratorsFailed(false);
      loadCurators()
        .then(setCurators)
        .catch(() => setCuratorsFailed(true))
        .finally(() => setLoadingCurators(false));
    }
  }, [canSearchCurators, curators.length, loadingCurators]);

  const onFocus = useCallback(() => {
    setOpen(true);
    ensureCurators();
  }, [ensureCurators]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const fns = FUNCTIONS.filter((f) => {
      if (!q) return true;
      return (
        f.code.toLowerCase().startsWith(q) ||
        f.label.toLowerCase().includes(q) ||
        (f.aliases ?? []).some((a) => a.includes(q))
      );
    })
      // Exact code first, then code prefix, then the rest in bar order.
      .sort((a, b) => {
        const rank = (code: string) =>
          code.toLowerCase() === q ? 0 : code.toLowerCase().startsWith(q) ? 1 : 2;
        return rank(a.code) - rank(b.code);
      })
      .map<Result>((f) => ({ kind: "fn", id: `fn-${f.code}`, code: f.code, label: f.label, href: f.href }));

    if (!q) return fns.slice(0, 9);

    const out: Result[] = [...fns.slice(0, 4)];
    if (canSearchCurators && loadingCurators && curators.length === 0) {
      out.push({ kind: "loading", id: "loading", label: "Loading curator names…" });
    } else if (canSearchCurators && curatorsFailed && curators.length === 0) {
      out.push({ kind: "error", id: "error", label: "Curator names did not load. Click the field again to retry." });
    } else if (canSearchCurators) {
      curators
        .filter((c) => c.name.toLowerCase().includes(q))
        .slice(0, 6)
        .forEach((c) =>
          out.push({ kind: "curator", id: `cur-${c.href}`, label: c.name, href: c.href, aum: c.aum })
        );
    } else if (q.length >= 2) {
      out.push({ kind: "gate", id: "gate", label: `Search curators for “${query.trim()}”` });
    }
    return out;
  }, [query, curators, canSearchCurators, loadingCurators, curatorsFailed]);

  const run = useCallback(
    (r: Result | undefined) => {
      if (!r || r.kind === "loading" || r.kind === "error") return;
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
      if (r.kind === "gate") {
        openGate("tools");
        return;
      }
      router.push(r.href);
      onDone?.();
    },
    [router, openGate, onDone]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showList = open && results.length > 0;

  return (
    <form
      role="search"
      className="relative flex items-stretch w-full"
      onSubmit={(e) => {
        e.preventDefault();
        run(results[active]);
      }}
    >
      <label htmlFor={`${listId}-input`} className="sr-only">
        Command: function code, page, or curator name
      </label>
      <span
        aria-hidden="true"
        className="flex items-center pl-2.5 pr-1.5 bg-background border border-r-0 border-border-strong font-mono text-xs font-bold text-accent-blue"
      >
        &gt;
      </span>
      <input
        ref={inputRef}
        id={`${listId}-input`}
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${listId}-list`}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${results[active].id}` : undefined}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
          ensureCurators();
        }}
        onFocus={onFocus}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        placeholder={canSearchCurators ? "Function or curator name" : "Function code or page"}
        className="peer min-w-0 flex-1 h-8 bg-background border-y border-border-strong px-1 font-mono text-[0.8rem] uppercase text-text-primary placeholder:normal-case placeholder:text-text-muted focus:outline-none"
      />
      <kbd className="hidden md:flex items-center px-2 bg-background border-y border-border-strong font-mono text-[0.7rem] text-text-muted peer-focus:hidden">
        /
      </kbd>
      <button
        type="submit"
        className="flex-none h-8 px-3 bg-accent-blue text-signal-ink font-mono text-[0.75rem] font-bold tracking-wide hover:bg-accent-blue-hover transition-colors"
      >
        GO
      </button>

      {showList && (
        <ul
          id={`${listId}-list`}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-px z-50 bg-background-subtle border border-border-strong shadow-[0_12px_32px_-8px_oklch(0%_0_0/0.7)] max-h-[60vh] overflow-y-auto"
        >
          {results.map((r, i) => (
            <li
              key={r.id}
              id={`${listId}-${r.id}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(r)}
              className={`flex items-center gap-3 h-8 px-2.5 cursor-pointer ${
                i === active ? "bg-background-hover" : ""
              }`}
            >
              {r.kind === "fn" && (
                <>
                  <span className="w-11 font-mono text-[0.75rem] font-bold text-accent-blue">{r.code}</span>
                  <span className="text-sm text-text-primary">{r.label}</span>
                  <span className="ml-auto label">Function</span>
                </>
              )}
              {r.kind === "curator" && (
                <>
                  <span className="w-11 font-mono text-[0.75rem] font-bold text-text-tertiary">CUR</span>
                  <span className="text-sm text-text-primary truncate">{r.label}</span>
                  <span className="ml-auto num text-xs text-text-secondary">{compactUsd(r.aum)}</span>
                </>
              )}
              {r.kind === "error" && (
                <span className="pl-14 text-sm text-accent-red">{r.label}</span>
              )}
              {r.kind === "loading" && (
                <span className="pl-14 text-sm text-text-tertiary">{r.label}</span>
              )}
              {r.kind === "gate" && (
                <>
                  <span className="w-11 font-mono text-[0.75rem] font-bold text-text-tertiary">CUR</span>
                  <span className="text-sm text-text-primary truncate">{r.label}</span>
                  <span className="ml-auto label text-accent-blue">Free account</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
