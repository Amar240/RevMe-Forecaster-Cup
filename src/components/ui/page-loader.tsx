'use client'

import { Loader2 } from 'lucide-react'

export function PageLoader({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      {message && (
        <p className="text-sm text-text-secondary">{message}</p>
      )}
    </div>
  )
}
