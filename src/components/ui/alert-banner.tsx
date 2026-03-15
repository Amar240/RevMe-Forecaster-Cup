'use client'

import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

type AlertVariant = 'info' | 'success' | 'warning' | 'error'

interface AlertBannerProps {
  variant: AlertVariant
  title?: string
  children: React.ReactNode
  dismissible?: boolean
  className?: string
  icon?: React.ReactNode
}

const variantStyles: Record<AlertVariant, { container: string; iconClass: string; icon: typeof Info }> = {
  info: { container: 'bg-info-background border-l-info', iconClass: 'text-info', icon: Info },
  success: { container: 'bg-success-background border-l-success', iconClass: 'text-success', icon: CheckCircle2 },
  warning: { container: 'bg-warning-background border-l-warning', iconClass: 'text-warning', icon: AlertTriangle },
  error: { container: 'bg-error-background border-l-error', iconClass: 'text-error', icon: AlertCircle },
}

export function AlertBanner({ variant, title, children, dismissible = false, className, icon }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const styles = variantStyles[variant]
  const IconComponent = icon ? null : styles.icon

  return (
    <div className={cn('flex items-start gap-3 rounded-lg border border-border border-l-4 p-4 shadow-sm', styles.container, className)} role="alert">
      {icon || (IconComponent && <IconComponent className={cn('mt-0.5 h-5 w-5 flex-shrink-0', styles.iconClass)} />)}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium text-foreground">{title}</p>}
        <div className="text-sm text-text-secondary">{children}</div>
      </div>
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
