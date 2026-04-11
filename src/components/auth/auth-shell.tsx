'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { BarChart3 } from 'lucide-react'

type AuthShellProps = {
  title: string
  description: string
  children: React.ReactNode
}

const authSurfaceTheme = {
  '--bg-surface': '#ffffff',
  '--bg-muted': '#f8fafc',
  '--border-default': '#d7e0ea',
  '--text-primary': '#0f172a',
  '--text-secondary': '#334155',
  '--text-muted': '#64748b',
  '--secondary': '#f1f5f9',
  '--secondary-hover': '#e8f0fa',
  '--secondary-text': '#334155',
  '--ring': 'rgba(31, 78, 140, 0.18)',
} as CSSProperties

export function AuthShell({ title, description, children }: AuthShellProps) {
  const featurePoints = [
    'Real hotel market data - Nashville, Dubai, Hamburg',
    'Live leaderboard updated each round',
    'University teams competing globally',
  ]

  return (
    <div className="min-h-screen bg-white lg:flex lg:flex-row">
      <aside className="hidden min-h-screen w-[45%] flex-col justify-between bg-[#1f4e8c] p-12 lg:flex">
        <div>
          <Link href="/" className="inline-flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
              <BarChart3 className="h-7 w-7" />
            </div>
            <div className="text-left">
              <div className="font-display text-2xl font-bold text-white">RevME</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.28em] text-white/60">
                Forecaster Cup
              </div>
            </div>
          </Link>
        </div>

        <div className="flex flex-1 items-center py-16">
          <div className="max-w-xl space-y-8">
            <div className="space-y-5">
              <h1 className="font-display text-5xl font-semibold leading-tight text-white">
                The Revenue Management Forecasting Competition
              </h1>
              <p className="max-w-lg text-lg leading-8 text-white/70">
                Compete with teams worldwide using real hotel market data across multiple rounds.
              </p>
            </div>

            <div className="space-y-4">
              {featurePoints.map((point) => (
                <div key={point} className="flex items-start gap-3 text-white/85">
                  <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-white/30" />
                  <p className="text-base leading-7">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-sm text-white/40">© RevME Forecaster Cup. All rights reserved.</p>
      </aside>

      <div className="flex-1 overflow-y-auto bg-white">
        <div className="flex min-h-screen items-center justify-center">
          <div className="w-full max-w-md px-8 py-12" style={authSurfaceTheme}>
            <div className="mb-8">
              <Link href="/" className="mb-5 inline-flex items-center gap-3 lg:hidden">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#1f4e8c] text-white shadow-sm">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="font-display text-xl font-semibold text-[#0f172a]">RevME</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#64748b]">Forecaster Cup</div>
                </div>
              </Link>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64748b] lg:hidden">
                Forecasting Competition Platform
              </p>
              <h1 className="mt-4 font-display text-3xl font-semibold text-[#0f172a]">{title}</h1>
              <p className="mt-2 text-sm text-[#334155]">{description}</p>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
