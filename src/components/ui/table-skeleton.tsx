'use client'

export function TableSkeleton({ columns = 4, rows = 5 }: { columns?: number; rows?: number }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 border-b px-4 py-3 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${100 / columns}%` }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b last:border-0 flex gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${Math.random() * 30 + 40}%` }} />
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
      <div className="h-7 bg-gray-200 rounded w-48" />
      <div className="h-4 bg-gray-100 rounded w-72" />
    </div>
  )
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={`border rounded-lg p-6 space-y-3 ${className || ''}`}>
      <div className="h-5 bg-gray-200 rounded w-32" />
      <div className="h-4 bg-gray-100 rounded w-full" />
      <div className="h-4 bg-gray-100 rounded w-3/4" />
    </div>
  )
}
