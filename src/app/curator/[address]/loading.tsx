// Curator-shaped skeleton shown while an uncached curator page renders on
// demand (first hit after a revalidation). Mirrors the header, key-figures
// strip, and panel grid so the swap to real content doesn't shift.
function SkeletonPanel({ h }: { h: string }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="h-2.5 w-24 bg-background-hover" />
      </div>
      <div className={h} />
    </div>
  );
}

export default function CuratorLoading() {
  return (
    <div className="animate-pulse space-y-1.5" aria-busy="true" aria-label="Loading curator profile">
      <div className="pb-3 border-b border-border">
        <div className="h-2.5 w-40 bg-background-elevated mb-2" />
        <div className="flex gap-3 items-start">
          <div className="h-6 w-10 bg-background-elevated flex-none" />
          <div className="w-9 h-9 bg-background-elevated flex-none" />
          <div className="flex-1 min-w-0">
            <div className="h-6 w-64 max-w-full bg-background-elevated mb-2" />
            <div className="h-3.5 w-80 max-w-full bg-background-elevated mb-2" />
            <div className="flex gap-1">
              <div className="h-5 w-20 bg-background-elevated" />
              <div className="h-5 w-16 bg-background-elevated" />
              <div className="h-5 w-24 bg-background-elevated" />
            </div>
          </div>
        </div>
      </div>
      <div className="panel h-[5.6rem]" />
      <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_23rem] items-start">
        <div className="grid gap-1.5">
          <SkeletonPanel h="h-28" />
          <SkeletonPanel h="h-64" />
          <SkeletonPanel h="h-56" />
        </div>
        <div className="grid gap-1.5">
          <SkeletonPanel h="h-48" />
          <SkeletonPanel h="h-32" />
          <SkeletonPanel h="h-40" />
        </div>
      </div>
    </div>
  );
}
