'use client'

import { useEffect } from 'react'
import { clientLogger } from '@/lib/client-logger'
import { Button } from '@/components/ui/button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    clientLogger.error('Dashboard error', {
      message: error.message,
      digest: error.digest,
    })
  }, [error])

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-xl font-semibold">Dashboard error</h1>
      <p className="text-sm text-zinc-600 mt-2">
        We ran into an issue loading this page. Try again, or go back to the dashboard.
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = '/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  )
}
