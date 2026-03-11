export default function TurtleVaultsLoading() {
  return (
    <div className="animate-pulse">
      {/* Page header skeleton */}
      <div className="mb-5">
        <div className="h-7 w-36 bg-background-elevated rounded mb-2" />
        <div className="h-4 w-72 bg-background-elevated rounded" />
      </div>

      {/* Disclaimer banner skeleton */}
      <div className="mb-6 h-16 rounded-xl bg-background-elevated" />

      {/* Stats bar skeleton */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="h-5 w-24 bg-background-elevated rounded" />
          <div className="h-5 w-36 bg-background-elevated rounded" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 bg-background-elevated rounded" />
        ))}
      </div>
    </div>
  );
}
