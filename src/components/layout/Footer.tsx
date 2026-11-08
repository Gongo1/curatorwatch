import Link from "next/link";

// Status line: product, refresh cadence, and the two keyboard affordances.
export function Footer() {
  return (
    <footer className="border-t border-border bg-background-subtle mt-6">
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap px-3 py-2 max-w-[1680px] mx-auto label">
        <span className="text-text-secondary">CuratorWatch</span>
        <span>Curator &amp; vault intelligence</span>
        <span>Data refresh every 6h</span>
        <Link href="/changelog" className="hover:text-accent-blue transition-colors">
          Changelog
        </Link>
        <Link href="/docs" className="hover:text-accent-blue transition-colors">
          Docs
        </Link>
        <span className="hidden md:inline ml-auto normal-case tracking-normal">
          <kbd className="num text-text-secondary">/</kbd> command ·{" "}
          <kbd className="num text-text-secondary">1–8</kbd> functions
        </span>
      </div>
    </footer>
  );
}
