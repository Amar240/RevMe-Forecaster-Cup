import Link from 'next/link'
import { RefreshCw } from 'lucide-react'

type QuickActionVariant = 'default' | 'primary' | 'warning' | 'success'

export interface QuickActionCardProps {
  icon: React.ElementType
  title: string
  description: string
  href?: string
  variant?: QuickActionVariant
  onClick?: () => void
  loading?: boolean
}

const VARIANT_STYLES: Record<QuickActionVariant, string> = {
  default: 'border-border bg-card hover:bg-surface-secondary',
  primary: 'border-primary/15 bg-primary-soft/70 hover:bg-primary-soft',
  warning: 'border-warning/20 bg-warning-background/70 hover:bg-warning-background',
  success: 'border-success/20 bg-success-background/70 hover:bg-success-background',
}

const ICON_STYLES: Record<QuickActionVariant, string> = {
  default: 'bg-muted text-text-secondary',
  primary: 'bg-primary-soft text-primary',
  warning: 'bg-warning-background text-warning',
  success: 'bg-success-background text-success',
}

export function QuickActionCard({
  icon: Icon,
  title,
  description,
  href,
  variant = 'default',
  onClick,
  loading,
}: QuickActionCardProps) {
  const content = (
    <div
      className={`cursor-pointer rounded-xl border p-4 transition-all ${VARIANT_STYLES[variant]} ${loading ? 'pointer-events-none opacity-50' : ''}`}
    >
      <div className="flex items-start space-x-4">
        <div className={`rounded-lg p-2.5 ${ICON_STYLES[variant]}`}>
          {loading ? (
            <RefreshCw className="h-5 w-5 animate-spin" />
          ) : (
            <Icon className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-sm text-text-secondary">{description}</p>
        </div>
      </div>
    </div>
  )

  if (onClick) {
    return (
      <button onClick={onClick} className="w-full text-left">
        {content}
      </button>
    )
  }

  return href ? <Link href={href}>{content}</Link> : content
}
