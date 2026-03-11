export default function VaultsLoading() {
  return (
    <div className="animate-pulse">
      {/* Page header skeleton */}
      <div className="mb-5">
        <div className="h-7 w-24 bg-background-elevated rounded mb-2" />
        <div className="h-4 w-52 bg-background-elevated rounded" />
      </div>

      {/* Two cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-background-subtle p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-background-elevated" />
            <div>
              <div className="h-5 w-40 bg-background-elevated rounded mb-1" />
              <div className="h-3 w-56 bg-background-elevated rounded" />
            </div>
          </div>
          <div className="flex gap-6">
            <div className="h-5 w-20 bg-background-elevated rounded" />
            <div className="h-5 w-28 bg-background-elevated rounded" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background-subtle p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-background-elevated" />
            <div>
              <div className="h-5 w-36 bg-background-elevated rounded mb-1" />
              <div className="h-3 w-48 bg-background-elevated rounded" />
            </div>
          </div>
          <div className="flex gap-6">
            <div className="h-5 w-20 bg-background-elevated rounded" />
            <div className="h-5 w-28 bg-background-elevated rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
