import Link from "next/link";

// One cell of a quote line (`<dl className="panel grid …">`): a label over a
// figure, with an optional qualifier. Values are off-white; `tone` is a class
// for signed change (up/down); `text` sets a name instead of a number.
export function Quote({
  k,
  v,
  sub,
  subClass = "label",
  tone,
  text = false,
  href,
}: {
  k: string;
  v: string;
  sub?: string;
  subClass?: string;
  tone?: string;
  text?: boolean;
  href?: string;
}) {
  const value = (
    <dd className="flex items-baseline gap-2 mt-1.5 min-w-0">
      <span
        className={`${text ? "cond font-bold text-[1.3rem] truncate" : "num font-semibold text-[1.45rem]"} leading-none ${
          tone ?? "text-text-primary"
        }`}
      >
        {v}
      </span>
      {sub && <span className={subClass}>{sub}</span>}
    </dd>
  );
  return (
    <div className="px-3 py-2.5 border-border border-b lg:border-b-0 border-r min-w-0">
      <dt className="label">{k}</dt>
      {href ? (
        <Link href={href} className="block hover:underline decoration-text-muted">
          {value}
        </Link>
      ) : (
        value
      )}
    </div>
  );
}
