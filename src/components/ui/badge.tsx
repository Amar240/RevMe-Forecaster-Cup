import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary-soft text-primary',
        secondary: 'border-transparent bg-muted text-text-secondary',
        destructive: 'border-transparent bg-error-background text-error',
        outline: 'border-border bg-transparent text-foreground',
        neutral: 'border-transparent bg-muted text-text-secondary',
        info: 'border-transparent bg-info-background text-info',
        success: 'border-transparent bg-success-background text-success',
        warning: 'border-transparent bg-warning-background text-warning',
        error: 'border-transparent bg-error-background text-error',
        medal: 'border-transparent bg-accent-soft text-accent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
