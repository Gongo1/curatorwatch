export default function CuratorsLoading() {
  return (
    <div className="animate-pulse">
      {/* Stat hero + asset mix */}
      <div className="grid lg:grid-cols-2 gap-8 mb-6 items-end">
        <div>
          <div className="h-3 w-32 bg-background-elevated rounded mb-3" />
          <div className="h-12 w-48 bg-background-elevated rounded mb-3" />
          <div className="h-4 w-72 bg-background-elevated rounded" />
        </div>
        <div>
          <div className="h-3 w-40 bg-background-elevated rounded mb-2.5" />
          <div className="h-3 w-full bg-background-elevated rounded" />
        </div>
      </div>

      {/* Context strip */}
      <div className="flex gap-12 py-4 border-y border-border-subtle mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className="h-3 w-16 bg-background-elevated rounded mb-2" />
            <div className="h-6 w-20 bg-background-elevated rounded" />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="h-64 bg-background-subtle border border-border rounded-xl mb-8" />

      {/* Curator index rows */}
      <div className="h-5 w-28 bg-background-elevated rounded mb-5" />
      <div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 py-3 border-t border-border-subtle"
          >
            <div className="h-4 w-4 bg-background-elevated rounded flex-shrink-0" />
            <div className="w-9 h-9 bg-background-elevated rounded-lg flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="h-4 w-40 bg-background-elevated rounded mb-1.5" />
              <div className="h-3 w-24 bg-background-elevated rounded" />
            </div>
            <div className="hidden sm:block h-2 w-36 bg-background-elevated rounded" />
            <div className="h-5 w-20 bg-background-elevated rounded flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
