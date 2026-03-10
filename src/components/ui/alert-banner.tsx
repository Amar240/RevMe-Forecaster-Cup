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

const variantStyles: Record<AlertVariant, { bg: string; border: string; text: string; icon: typeof Info }> = {
  info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: Info },
  success: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon: CheckCircle2 },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: AlertTriangle },
  error: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: AlertCircle },
}

export function AlertBanner({ variant, title, children, dismissible = false, className, icon }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const styles = variantStyles[variant]
  const IconComponent = icon ? null : styles.icon

  return (
    <div className={cn('flex items-start gap-3 rounded-lg border p-4', styles.bg, styles.border, styles.text, className)} role="alert">
      {icon || (IconComponent && <IconComponent className="h-5 w-5 flex-shrink-0 mt-0.5" />)}
      <div className="flex-1 min-w-0">
        {title && <p className="font-medium">{title}</p>}
        <div className="text-sm">{children}</div>
      </div>
      {dismissible && (
        <button onClick={() => setDismissed(true)} className="flex-shrink-0 p-1 rounded hover:bg-black/5" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
