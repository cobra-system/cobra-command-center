import { Skeleton } from "@/components/ui/skeleton";

/**
 * Generic loading placeholder for list/table pages (header + optional KPI
 * stat cards + a table). Mirrors the typical page layout so the shell doesn't
 * jump when real data arrives. Uses design tokens so it adapts to dark mode.
 */
export function TablePageSkeleton({
  statCards = 4,
  rows = 8,
  showHeader = true,
}: {
  statCards?: number;
  rows?: number;
  showHeader?: boolean;
}) {
  return (
    <div className="space-y-6 page-fade-in" role="status" aria-label="טוען נתונים">
      {showHeader && (
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-28" />
        </div>
      )}

      {statCards > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: statCards }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border p-4 shadow-sm space-y-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-12" />
            </div>
          ))}
        </div>
      )}

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="border-b p-3">
          <Skeleton className="h-5 w-full max-w-md" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/5" />
              <Skeleton className="h-4 w-1/6 hidden sm:block" />
              <Skeleton className="h-4 w-12 ms-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TablePageSkeleton;
