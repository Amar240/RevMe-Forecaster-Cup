'use client'

import { ShieldX, ArrowLeft, Mail } from 'lucide-react'
import { Button } from './button'
import { Card, CardContent } from './card'
import { Badge } from './badge'
import Link from 'next/link'

interface AccessDeniedProps {
  title?: string
  message?: string
  showBackButton?: boolean
  backUrl?: string
}

export function AccessDenied({
  title = 'Access Denied',
  message = 'You do not have permission to access this page. Please contact an administrator for assistance.',
  showBackButton = true,
  backUrl = '/dashboard',
}: AccessDeniedProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-lg border-border/90 shadow-card">
        <CardContent className="px-8 py-10 text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-error-background">
            <ShieldX className="h-10 w-10 text-error" />
          </div>
          <Badge variant="error" className="mb-4">
            Restricted Area
          </Badge>
          <h1 className="mb-3 text-2xl font-semibold text-foreground">{title}</h1>
          <p className="mb-6 text-text-secondary">{message}</p>
          <div className="mb-6 rounded-xl border border-border bg-surface-secondary p-4">
            <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>Contact your administrator to request access</span>
            </div>
          </div>
        {showBackButton && (
          <Link href={backUrl}>
            <Button variant="outline" className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        )}
        </CardContent>
      </Card>
    </div>
  )
}
