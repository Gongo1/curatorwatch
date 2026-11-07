import Link from "next/link";

// The one container in the terminal: hairline box, title bar on top (amber
// title, grey meta on the right), body below. Title can link to its function.

export function Panel({
  title,
  meta,
  href,
  action,
  children,
  className = "",
  bodyClassName = "",
  as: Tag = "section",
}: {
  title: string;
  meta?: React.ReactNode;
  href?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: "section" | "div" | "aside";
}) {
  return (
    <Tag className={`panel flex flex-col ${className}`}>
      <div className="panel-head">
        {href ? (
          <Link href={href} className="panel-title hover:underline">
            {title}
          </Link>
        ) : (
          <h2 className="panel-title">{title}</h2>
        )}
        {meta && <span className="panel-meta">{meta}</span>}
        {action && <span className={meta ? "flex-none" : "ml-auto flex-none"}>{action}</span>}
      </div>
      <div className={`flex-1 min-h-0 ${bodyClassName}`}>{children}</div>
    </Tag>
  );
}
