'use client'

import { useEffect } from 'react'
import { clientLogger } from '@/lib/client-logger'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    clientLogger.error('Global app error', {
      message: error.message,
      digest: error.digest,
    })
  }, [error])

  return (
    <html>
      <body className="min-h-screen bg-zinc-50 text-zinc-900">
        <div className="max-w-2xl mx-auto px-6 py-16">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-zinc-600 mt-2">
            An unexpected error occurred. Try again, or refresh the page.
          </p>
          <div className="mt-6 flex gap-3">
            <Button onClick={reset}>Try again</Button>
            <Button variant="outline" onClick={() => location.reload()}>
              Reload
            </Button>
          </div>
        </div>
      </body>
    </html>
  )
}
