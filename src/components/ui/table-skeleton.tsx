'use client'

export function TableSkeleton({ columns = 4, rows = 5 }: { columns?: number; rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex gap-4 border-b border-border bg-muted px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-surface-secondary" style={{ width: `${100 / columns}%` }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 border-b border-border px-4 py-3 last:border-0">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${Math.random() * 30 + 40}%` }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6 animate-pulse">{children}</div>
}

export function TitleSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-7 w-48 rounded bg-surface-secondary" />
      <div className="h-4 w-72 rounded bg-muted" />
    </div>
  )
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={`space-y-3 rounded-lg border border-border p-6 ${className || ''}`}>
      <div className="h-5 w-32 rounded bg-surface-secondary" />
      <div className="h-4 w-full rounded bg-muted" />
      <div className="h-4 w-3/4 rounded bg-muted" />
    </div>
  )
}
