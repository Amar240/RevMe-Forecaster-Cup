'use client'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Tooltip({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return <TooltipPrimitive.Provider delayDuration={250} skipDelayDuration={100}><TooltipPrimitive.Root><TooltipPrimitive.Trigger asChild><span tabIndex={0} className={cn('inline-flex cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}>{children}</span></TooltipPrimitive.Trigger><TooltipPrimitive.Portal><TooltipPrimitive.Content sideOffset={7} className="z-50 max-w-64 rounded-lg bg-foreground px-3 py-2 text-xs font-normal text-background shadow-lg motion-safe:animate-in motion-safe:fade-in" collisionPadding={10}><TooltipPrimitive.Arrow className="fill-foreground" />{label}</TooltipPrimitive.Content></TooltipPrimitive.Portal></TooltipPrimitive.Root></TooltipPrimitive.Provider>
}
