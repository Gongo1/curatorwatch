import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="px-4 sm:px-6 py-4 max-w-[1400px] w-full mx-auto">
        <div className="flex items-center gap-2 flex-wrap text-xs text-text-tertiary font-mono">
          <span>CuratorWatch</span>
          <span className="text-text-muted">·</span>
          <span>On-chain curator &amp; vault intelligence</span>
          <span className="text-text-muted">·</span>
          <span>Updated every 6h</span>
          <span className="text-text-muted">·</span>
          <Link
            href="/changelog"
            className="hover:text-text-primary transition-colors"
          >
            Changelog
          </Link>
        </div>
      </div>
    </footer>
  );
}
