import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background-subtle mt-auto">
      <div className="px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between text-xs text-text-tertiary">
          <p>
            Data from{" "}
            <a
              href="https://api.morpho.org/graphql"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-blue hover:text-accent-blue-hover"
            >
              Morpho API
            </a>
            {" "}& Turtle &bull; Updated hourly
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/changelog"
              className="text-text-tertiary hover:text-text-primary transition-colors"
            >
              Changelog
            </Link>
            <a
              href="https://x.com/curator_watch"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-tertiary hover:text-text-primary transition-colors"
              title="Follow us on X"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
              Live
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
