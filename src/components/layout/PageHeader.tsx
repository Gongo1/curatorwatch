import Link from "next/link";
import { FnTag } from "./FnTag";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  /** Override the function code derived from the route. */
  code?: string;
}

// Page bar: function tag, condensed title, one line of context, actions right.
export function PageHeader({ title, description, breadcrumbs, actions, code }: PageHeaderProps) {
  return (
    <div className="mb-3 pb-3 border-b border-border">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 mb-2 label">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-text-muted">/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-accent-blue transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-text-secondary">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <FnTag code={code} />
          <div className="min-w-0">
            <h1 className="cond text-[1.45rem] leading-none font-bold tracking-[0.01em] text-text-primary">
              {title}
            </h1>
            {description && <p className="text-sm text-text-secondary mt-1.5 max-w-[75ch]">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-1.5 max-w-full">{actions}</div>}
      </div>
    </div>
  );
}
