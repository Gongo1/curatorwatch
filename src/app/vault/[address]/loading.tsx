// Vault-shaped skeleton shown while an uncached vault page renders on demand.
export default function VaultLoading() {
  return (
    <div className="animate-pulse space-y-1.5" aria-busy="true" aria-label="Loading vault">
      <div className="pb-3 mb-1.5 border-b border-border">
        <div className="h-3 w-48 bg-background-elevated mb-2" />
        <div className="flex items-start gap-3">
          <div className="h-6 w-10 bg-background-elevated" />
          <div>
            <div className="h-6 w-64 bg-background-elevated mb-1.5" />
            <div className="h-3.5 w-40 bg-background-elevated" />
          </div>
        </div>
      </div>

      <div className="panel grid grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="px-3 py-2.5 border-r border-b lg:border-b-0 border-border">
            <div className="h-3 w-20 bg-background-elevated mb-2" />
            <div className="h-6 w-24 bg-background-elevated" />
          </div>
        ))}
      </div>

      <div className="h-7 w-96 max-w-full border border-border-strong" />

      <div className="panel">
        <div className="panel-head" />
        <div className="p-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 bg-background-elevated" />
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head" />
        <div className="grid grid-cols-2 gap-3 p-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="h-3 w-24 bg-background-elevated mb-2" />
              <div className="h-3.5 w-32 bg-background-elevated/50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
