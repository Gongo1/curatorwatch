// Curator-shaped skeleton shown while an uncached curator page renders on
// demand (first hit after a revalidation). Mirrors the masthead layout so
// the swap to real content doesn't shift.
export default function CuratorLoading() {
  return (
    <div className="animate-pulse max-w-[1000px]">
      <div className="h-3 w-40 bg-background-elevated rounded mb-6" />
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-start mb-8">
        <div className="flex gap-4">
          <div className="w-14 h-14 bg-background-elevated rounded-[13px] flex-none" />
          <div className="flex-1">
            <div className="h-9 w-64 bg-background-elevated rounded mb-3" />
            <div className="h-4 w-80 bg-background-elevated rounded mb-4" />
            <div className="flex gap-2">
              <div className="h-7 w-24 bg-background-elevated rounded-md" />
              <div className="h-7 w-20 bg-background-elevated rounded-md" />
              <div className="h-7 w-28 bg-background-elevated rounded-md" />
            </div>
          </div>
        </div>
        <div className="h-56 bg-background-subtle border border-border rounded-2xl" />
      </div>
      <div className="h-40 bg-background-subtle border border-border rounded-2xl mb-8" />
      <div className="h-64 bg-background-subtle border border-border rounded-2xl" />
    </div>
  );
}
