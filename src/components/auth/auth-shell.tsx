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
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fbfcfe] px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(31,78,140,0.08),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(200,155,60,0.12),_transparent_20%)]" />
      <div className="absolute left-[-8rem] top-[-6rem] h-80 w-80 rounded-full bg-[#dbeafe] blur-3xl" />
      <div className="absolute bottom-[-8rem] right-[-6rem] h-96 w-96 rounded-full bg-[#fef3c7] blur-3xl" />

      <div
        className="relative w-full max-w-md rounded-3xl border border-[#d7e0ea] bg-white p-8 shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
        style={authSurfaceTheme}
      >
        <div className="mb-8 text-center">
          <Link href="/" className="mb-5 inline-flex items-center justify-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#1f4e8c] text-white shadow-sm">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div className="text-left">
              <div className="font-display text-xl font-semibold text-[#0f172a]">RevME</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[#64748b]">Forecaster Cup</div>
            </div>
          </Link>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64748b]">
            Forecasting Competition Platform
          </p>
          <h1 className="mt-4 font-display text-3xl font-semibold text-[#0f172a]">{title}</h1>
          <p className="mt-2 text-sm text-[#334155]">{description}</p>
        </div>

        {children}
      </div>
    </div>
  )
}
