import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  /** Icon rendered in a soft circle. Pass a Lucide icon element. */
  icon?: ReactNode
  title: string
  description?: ReactNode
  /** Optional call-to-action (button/link). */
  action?: ReactNode
  className?: string
}

/**
 * Canonical empty state. Replaces the many bespoke "No X yet" blocks so every empty view reads the
 * same way: a soft icon, a title, one explanatory line, and (optionally) the next action. Drop it
 * inside a Card/CardContent, or use it standalone.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-secondary text-text-muted">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-text-secondary">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
