import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  /** The page title. Rendered in the brand display face for a consistent premium heading rhythm. */
  title: ReactNode
  /** Supporting one-liner under the title. */
  description?: ReactNode
  /** Small uppercase context label above the title (breadcrumb / section). */
  eyebrow?: ReactNode
  /** Right-aligned actions (buttons, filters). */
  actions?: ReactNode
  /** Optional leading icon rendered beside the title. */
  icon?: ReactNode
  className?: string
}

/**
 * Canonical page title block. Every dashboard page should use this instead of hand-rolling an <h1>,
 * so heading size, weight, face, and the title/description/action rhythm stay identical everywhere.
 */
export function PageHeader({ title, description, eyebrow, actions, icon, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{eyebrow}</p>
        ) : null}
        <div className="flex items-center gap-3">
          {icon ? <span className="shrink-0 text-primary">{icon}</span> : null}
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        </div>
        {description ? <p className="max-w-2xl text-text-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
