"use client";

export function VaultTableSkeleton() {
  const rows = Array.from({ length: 10 }, (_, i) => i);

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-background-subtle animate-pulse">
      <table className="min-w-full">
        <thead className="bg-background-elevated border-b border-border">
          <tr>
            <th className="px-4 py-3 text-left">
              <div className="h-4 w-16 bg-background-hover rounded" />
            </th>
            <th className="px-4 py-3 text-left">
              <div className="h-4 w-12 bg-background-hover rounded" />
            </th>
            <th className="px-4 py-3 text-right">
              <div className="h-4 w-10 bg-background-hover rounded ml-auto" />
            </th>
            <th className="px-4 py-3 text-right">
              <div className="h-4 w-10 bg-background-hover rounded ml-auto" />
            </th>
            <th className="px-4 py-3 text-right">
              <div className="h-4 w-14 bg-background-hover rounded ml-auto" />
            </th>
            <th className="px-4 py-3 text-center">
              <div className="h-4 w-14 bg-background-hover rounded mx-auto" />
            </th>
            <th className="px-4 py-3 text-left">
              <div className="h-4 w-16 bg-background-hover rounded" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {rows.map((i) => (
            <tr key={i}>
              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-background-elevated rounded-lg" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-background-elevated rounded" />
                    <div className="h-3 w-24 bg-background-elevated/50 rounded" />
                  </div>
                </div>
              </td>
              <td className="px-4 py-4">
                <div className="h-6 w-14 bg-background-elevated rounded-md" />
              </td>
              <td className="px-4 py-4">
                <div className="h-4 w-20 bg-background-elevated rounded ml-auto" />
              </td>
              <td className="px-4 py-4">
                <div className="h-4 w-12 bg-background-elevated rounded ml-auto" />
              </td>
              <td className="px-4 py-4">
                <div className="h-4 w-12 bg-background-elevated rounded ml-auto" />
              </td>
              <td className="px-4 py-4">
                <div className="h-5 w-8 bg-background-elevated rounded mx-auto" />
              </td>
              <td className="px-4 py-4">
                <div className="h-4 w-24 bg-background-elevated rounded" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
