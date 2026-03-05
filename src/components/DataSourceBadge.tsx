export function DataSourceBadge({ dataSource }: { dataSource?: string | null }) {
  if (!dataSource) return null;

  const isTurtle = dataSource === "turtle";

  return (
    <span
      className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
        isTurtle
          ? "bg-green-100 text-green-800"
          : "bg-blue-100 text-blue-800"
      }`}
    >
      {isTurtle ? "Turtle" : "Morpho V2"}
    </span>
  );
}
