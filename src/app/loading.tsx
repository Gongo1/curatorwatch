// Skeleton in the home layout: market line, ranking panel, side panels.
export default function CuratorsLoading() {
  return (
    <div className="animate-pulse space-y-1.5" aria-busy="true" aria-label="Loading">
      {/* Market line */}
      <div className="panel">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-3 py-2.5 border-border border-b lg:border-b-0 border-r">
              <div className="h-2.5 w-16 bg-background-elevated mb-2" />
              <div className="h-5 w-20 bg-background-elevated" />
            </div>
          ))}
        </div>
        <div className="border-t border-border px-3 py-1.5">
          <div className="h-2.5 w-40 bg-background-elevated" />
        </div>
      </div>

      <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_23rem] items-start">
        {/* Ranking */}
        <div className="panel">
          <div className="panel-head">
            <div className="h-2.5 w-28 bg-background-hover" />
          </div>
          <div className="px-2 py-1.5 border-b border-border">
            <div className="h-7 w-full bg-background" />
          </div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 h-9 border-b border-border-subtle">
              <div className="h-3 w-4 bg-background-elevated flex-none" />
              <div className="h-5 w-5 bg-background-elevated flex-none" />
              <div className="h-3 w-40 bg-background-elevated" />
              <div className="hidden sm:block h-3 w-14 bg-background-elevated ml-auto" />
              <div className="h-3 w-16 bg-background-elevated ml-auto sm:ml-0" />
            </div>
          ))}
        </div>

        {/* Side panels */}
        <div className="grid gap-1.5">
          {[0, 1].map((p) => (
            <div key={p} className="panel">
              <div className="panel-head">
                <div className="h-2.5 w-24 bg-background-hover" />
              </div>
              <div className="p-3 space-y-2">
                <div className="h-2.5 w-full bg-background-elevated" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-3 w-3/4 bg-background-elevated" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
