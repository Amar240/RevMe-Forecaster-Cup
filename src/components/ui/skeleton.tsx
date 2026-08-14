import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-surface-secondary", className)}
      {...props}
    />
  )
}

function CardSkeleton() {
  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-10 w-20" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex items-center space-x-4 py-4 border-b">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
  )
}

function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-0">
      <div className="flex items-center space-x-4 border-b border-border bg-muted py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </div>
  )
}

function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="relative" style={{ height }}>
      <Skeleton className="absolute bottom-0 left-0 w-full h-4/5 rounded-t-lg" />
      <div className="absolute bottom-4 left-4 right-4 flex justify-between">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      
      <div className="rounded-lg border border-border p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <ChartSkeleton height={250} />
      </div>
    </div>
  )
}

/** Standard loading shape for a list/CRUD page: header line, optional stat row, then a table. */
function ListPageSkeleton({ withStats = false, columns = 5, rows = 6 }: { withStats?: boolean; columns?: number; rows?: number }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      {withStats ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : null}
      <div className="rounded-xl border border-border p-4">
        <TableSkeleton rows={rows} columns={columns} />
      </div>
    </div>
  )
}

export { Skeleton, CardSkeleton, TableRowSkeleton, TableSkeleton, ChartSkeleton, DashboardSkeleton, ListPageSkeleton }
