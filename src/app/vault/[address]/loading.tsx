// Vault-shaped skeleton shown while an uncached vault page renders on demand.
export default function VaultLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-5">
        <div className="h-4 w-48 bg-background-elevated rounded mb-2" />
        <div className="h-6 w-64 bg-background-elevated rounded mb-1" />
        <div className="h-4 w-40 bg-background-elevated rounded" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-background-subtle rounded-lg border border-border p-4">
            <div className="h-4 w-20 bg-background-elevated rounded mb-2" />
            <div className="h-8 w-24 bg-background-elevated rounded" />
          </div>
        ))}
      </div>

      <div className="bg-background-subtle rounded-lg border border-border p-6 mb-6">
        <div className="h-5 w-40 bg-background-elevated rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-background-elevated rounded" />
          ))}
        </div>
      </div>

      <div className="bg-background-subtle rounded-lg border border-border p-6">
        <div className="h-5 w-40 bg-background-elevated rounded mb-4" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="h-4 w-24 bg-background-elevated rounded mb-2" />
              <div className="h-4 w-32 bg-background-elevated/50 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
