'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { clientLogger } from '@/lib/client-logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Card>
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-error-background text-error">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <CardTitle>Dashboard error</CardTitle>
          <CardDescription>
            We ran into an issue loading this page. Try again, or go back to the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" onClick={() => (window.location.href = '/dashboard')}>
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
