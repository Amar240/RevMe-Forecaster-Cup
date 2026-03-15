'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { clientLogger } from '@/lib/client-logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
      <body className="min-h-screen bg-background text-foreground">
        <div className="flex min-h-screen items-center justify-center px-6 py-16">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-error-background text-error">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>
                An unexpected error occurred. Try again, or reload the application.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button onClick={reset}>Try again</Button>
              <Button variant="outline" onClick={() => location.reload()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reload
              </Button>
            </CardContent>
          </Card>
        </div>
      </body>
    </html>
  )
}
