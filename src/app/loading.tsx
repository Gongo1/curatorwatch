export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      {/* Page header skeleton */}
      <div className="mb-5">
        <div className="h-7 w-40 bg-background-elevated rounded mb-2" />
        <div className="h-4 w-64 bg-background-elevated rounded" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="bg-background-subtle border border-border rounded-xl p-4">
            <div className="h-4 w-16 bg-background-elevated rounded mb-2" />
            <div className="h-7 w-24 bg-background-elevated rounded" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="mb-5 bg-background-subtle border border-border rounded-xl p-6">
        <div className="h-5 w-32 bg-background-elevated rounded mb-4" />
        <div className="h-64 bg-background-elevated rounded" />
      </div>

      {/* Cards row skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="bg-background-subtle border border-border rounded-xl p-6 h-48" />
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-background-subtle border border-border rounded-xl p-6 h-48" />
          <div className="bg-background-subtle border border-border rounded-xl p-6 h-48" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-background-elevated rounded" />
        ))}
      </div>
    </div>
  );
}
