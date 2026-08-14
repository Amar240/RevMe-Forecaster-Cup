'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { BarChart3, Check } from 'lucide-react'

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

/** Decorative forecast curve — evokes the product without competing with the copy. Purely visual. */
function ForecastMotif() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-64 w-full text-white"
      viewBox="0 0 800 260"
      preserveAspectRatio="none"
      fill="none"
    >
      <defs>
        <linearGradient id="auth-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* faint gridlines */}
      {[52, 104, 156, 208].map((y) => (
        <line key={y} x1="0" y1={y} x2="800" y2={y} stroke="currentColor" strokeOpacity="0.06" strokeWidth="1" />
      ))}
      {/* forecast area + curve */}
      <path d="M0 210 C 120 150, 190 180, 300 130 S 520 60, 640 92 S 760 70, 800 58 L 800 260 L 0 260 Z" fill="url(#auth-area)" />
      <path
        d="M0 210 C 120 150, 190 180, 300 130 S 520 60, 640 92 S 760 70, 800 58"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {[[300, 130], [640, 92], [800, 58]].map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r="3.5" fill="currentColor" fillOpacity="0.7" />
      ))}
    </svg>
  )
}

export function AuthShell({ title, description, children }: AuthShellProps) {
  const featurePoints = [
    'Real hotel market data — Nashville CBD, BUR Dubai, Hamburg Center',
    'Live leaderboard updated every round',
    'University teams competing worldwide',
  ]

  return (
    <div className="min-h-screen bg-white lg:flex lg:flex-row">
      <aside className="relative hidden min-h-screen w-[45%] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#1f4e8c] via-[#173d70] to-[#0e2547] p-12 lg:flex">
        {/* depth: soft glow + decorative motif */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.22),transparent_58%)]"
        />
        <ForecastMotif />

        <div className="relative">
          <Link href="/" className="group inline-flex items-center gap-4 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-white/50">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-lg shadow-black/20 backdrop-blur-sm transition-colors duration-200 group-hover:bg-white/15">
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

        <div className="relative flex flex-1 items-center py-16">
          <div className="max-w-xl space-y-9">
            <div className="space-y-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/50">
                Revenue Management · Forecasting Competition
              </p>
              <h1 className="font-display text-[2.9rem] font-semibold leading-[1.1] text-white">
                Forecast like the pros.<br />Compete like a team.
              </h1>
              <p className="max-w-lg text-lg leading-8 text-white/70">
                Predict real hotel market performance across multiple rounds and climb a live global leaderboard.
              </p>
            </div>

            <ul className="space-y-3.5">
              {featurePoints.map((point) => (
                <li key={point} className="flex items-start gap-3 text-white/90">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10">
                    <Check className="h-3 w-3 text-white" />
                  </span>
                  <p className="text-[15px] leading-6">{point}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="relative text-sm text-white/40">© RevME Forecaster Cup. All rights reserved.</p>
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
