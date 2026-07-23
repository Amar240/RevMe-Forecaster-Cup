"use client"

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ComponentProps, ReactNode } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  Menu,
  Minus,
  Quote,
  Sparkles,
  Target,
  TrendingDown,
  Trophy,
  X,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  mobileMenuBackdrop,
  mobileMenuPanel,
  sectionReveal,
  sectionTransition,
  sectionViewport,
} from '@/components/landing/animations'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GridBeamCanvas, GridBeamDividers, useGridBeam } from '@/components/ui/grid-beam'
import {
  brand,
  competitionPrinciples,
  faqItems,
  faqSection as faqSectionContent,
  finalCtaSection,
  footerLinks,
  governanceBadges,
  heroCopy,
  heroStats,
  howItWorks,
  howItWorksSection,
  industryBridgeSection,
  leaderboardData,
  leaderboardProvocation,
  leaderboardSection,
  markets,
  marketsSection as marketsSectionContent,
  productPreviewSection,
  productPreviewTrendData,
  programOutcomesSection,
  proofStrip,
  scoringFormula,
  testimonials,
  testimonialsSection as testimonialsSectionContent,
  trustSignals,
  universitiesSection,
  universityFeatures,
} from '@/data/landing'

type AudienceType = 'student' | 'professor'

const revealProps = {
  variants: sectionReveal,
  initial: 'hidden' as const,
  whileInView: 'visible' as const,
  viewport: sectionViewport,
  transition: sectionTransition,
}

const sectionLinks = [
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#leaderboard', label: 'Leaderboard' },
  { href: '#markets', label: 'Markets' },
  { href: '#universities', label: 'For Universities' },
]

const trendTone = {
  up: 'text-success',
  same: 'text-warning',
  down: 'text-text-muted',
} as const

/* Universities already surfaced in the shipped competition data. */
const marqueeUniversities = Array.from(new Set(leaderboardData.map((row) => row.university)))

/* Build a smooth-ish sparkline path from MAPE values (lower is better, so the line descends). */
function buildSparkline(values: number[], w: number, h: number, pad = 10) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const stepX = (w - pad * 2) / (values.length - 1)
  const points = values.map((v, i) => {
    const x = pad + i * stepX
    const y = pad + ((max - v) / range) * (h - pad * 2)
    return { x, y }
  })
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
  const area = `${line} L ${points[points.length - 1].x.toFixed(1)} ${h} L ${points[0].x.toFixed(1)} ${h} Z`
  return { line, area, points }
}

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-active text-primary-foreground shadow-glow">
        <BarChart3 className="h-5 w-5" />
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background bg-accent" />
      </div>
      <div className="leading-tight">
        <div className="font-display text-[1.6rem] font-semibold tracking-tight text-foreground">
          {brand.name}
        </div>
        {!compact ? (
          <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-text-muted">
            Forecaster Cup
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  eyebrowVariant = 'default',
  title,
  subtext,
  align = 'center',
}: {
  eyebrow?: string
  eyebrowVariant?: ComponentProps<typeof Badge>['variant']
  title: ReactNode
  subtext?: string
  align?: 'center' | 'left'
}) {
  return (
    <motion.div
      className={`max-w-3xl ${align === 'center' ? 'mx-auto text-center' : ''}`}
      {...revealProps}
    >
      {eyebrow ? (
        <Badge variant={eyebrowVariant} className="mb-5 px-3 py-1.5">
          {eyebrow}
        </Badge>
      ) : null}
      <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {subtext ? <p className="mt-4 text-lg leading-8 text-text-secondary">{subtext}</p> : null}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* Announcement bar                                                    */
/* ------------------------------------------------------------------ */

function AnnouncementBar({ heroStatusLabel }: { heroStatusLabel: string }) {
  return (
    <div className="relative overflow-hidden bg-primary-active text-primary-foreground">
      <div className="bg-grid-dark absolute inset-0 opacity-40" />
      <Link
        href="/register"
        className="relative mx-auto flex max-w-7xl items-center justify-center gap-2.5 px-4 py-2 text-center text-[13px] font-medium sm:px-6 lg:px-8"
      >
        <span className="relative inline-flex h-2 w-2 text-accent">
          <span className="live-ping absolute inset-0" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        <span className="text-white/90">{heroStatusLabel}</span>
        <span className="hidden text-white/50 sm:inline">·</span>
        <span className="hidden items-center gap-1 font-semibold text-white sm:inline-flex">
          Enter before Round 1 closes
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </Link>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function SiteHeader({ audience }: { audience: AudienceType }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const primaryHref = audience === 'professor' ? '/request-demo' : '/register'
  const primaryLabel = audience === 'professor' ? 'Request Demo' : 'Create Account'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    if (mobileMenuOpen) document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileMenuOpen])

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled
            ? 'border-b border-border bg-background/80 shadow-card backdrop-blur-xl'
            : 'border-b border-transparent bg-background/50 backdrop-blur-md'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="shrink-0">
            <BrandLockup />
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {sectionLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-muted hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 lg:flex">
              <Link href="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href={primaryHref}>
                <Button className="group">
                  {primaryLabel}
                  <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="lg:hidden"
              aria-label="Open navigation menu"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileMenuOpen ? (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial="hidden" animate="visible" exit="exit">
            <motion.div
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
              variants={mobileMenuBackdrop}
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-background px-6 pb-8 pt-6 shadow-popover"
              variants={mobileMenuPanel}
            >
              <div className="flex items-center justify-between gap-4">
                <BrandLockup />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Close navigation menu"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <nav className="mt-10 flex flex-col gap-2">
                {sectionLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="rounded-xl border border-transparent px-3 py-3 text-base font-medium text-foreground transition-colors hover:border-border hover:bg-surface-secondary"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
              <div className="mt-auto space-y-3 pt-8">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full">
                    Sign In
                  </Button>
                </Link>
                <Link href={primaryHref} onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full">{primaryLabel}</Button>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Hero + forecast console                                             */
/* ------------------------------------------------------------------ */

function AudienceToggle({
  audience,
  onAudienceChange,
}: {
  audience: AudienceType
  onAudienceChange: (audience: AudienceType) => void
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-surface/80 p-1 shadow-card backdrop-blur">
      {(['student', 'professor'] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onAudienceChange(value)}
          className={`relative rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
            audience === value ? 'text-primary-foreground' : 'text-text-secondary hover:text-foreground'
          }`}
        >
          {audience === value ? (
            <motion.span
              layoutId="audience-pill"
              className="absolute inset-0 rounded-full bg-primary shadow-card"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          ) : null}
          <span className="relative z-10">{value === 'student' ? "I'm a student" : "I'm a professor"}</span>
        </button>
      ))}
    </div>
  )
}

function ForecastConsole() {
  const values = productPreviewTrendData.map((d) => d.teamMape)
  const { line, area, points } = useMemo(() => buildSparkline(values, 320, 120), [values])
  const podium = leaderboardData.slice(0, 3)
  const dashLen = 900

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 28, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
    >
      {/* floating prize card */}
      <div className="animate-float absolute -right-3 -top-6 z-20 hidden rounded-2xl border border-border bg-card px-4 py-3 shadow-popover sm:block">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Prize pool</p>
        <p className="font-display text-xl font-semibold text-foreground">$1,000</p>
      </div>

      {/* glow */}
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-primary/10 blur-3xl" />

      <div className="gradient-border overflow-hidden rounded-2xl bg-card shadow-glow">
        {/* window chrome */}
        <div className="flex items-center justify-between border-b border-border bg-surface-secondary/70 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-error/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
            <span className="ml-2 font-mono-ui text-xs text-text-muted">revme.org/season/round-3</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-background px-2.5 py-1 text-[11px] font-semibold text-success">
            <span className="relative inline-flex h-1.5 w-1.5 text-success">
              <span className="live-ping absolute inset-0" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            Live
          </span>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">
                Round 3 · Forecast window
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-foreground">
                Occupancy &amp; ADR · 3 live markets
              </p>
            </div>
            <div className="rounded-xl bg-primary-soft px-3 py-2 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Closes</p>
              <p className="font-mono-ui text-sm font-semibold text-primary">Sat 11:59 PM ET</p>
            </div>
          </div>

          {/* sparkline */}
          <div className="rounded-xl border border-border bg-surface-secondary/50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-text-secondary">Team MAPE trajectory</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-success-background px-2 py-0.5 text-[11px] font-semibold text-success">
                <TrendingDown className="h-3 w-3" />
                14.2% → 8.0%
              </span>
            </div>
            <svg viewBox="0 0 320 120" className="mt-3 h-28 w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="spark-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="spark-line" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--primary)" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
              <path d={area} fill="url(#spark-area)" />
              <path
                d={line}
                fill="none"
                stroke="url(#spark-line)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-draw"
                style={{ '--dash-len': dashLen } as CSSProperties}
              />
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={i === points.length - 1 ? 4 : 2.5}
                  fill={i === points.length - 1 ? '#3b82f6' : 'var(--primary)'}
                />
              ))}
            </svg>
          </div>

          {/* mini leaderboard */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-text-secondary">Round 3 leaderboard</p>
              <span className="font-mono-ui text-[11px] text-text-muted">72 / 78 scored</span>
            </div>
            {podium.map((row) => (
              <div
                key={row.rank}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
                    row.rank === 1
                      ? 'bg-accent-soft text-medal-gold'
                      : row.rank === 2
                        ? 'bg-muted text-medal-silver'
                        : 'bg-warning-background text-medal-bronze'
                  }`}
                >
                  {row.rank}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{row.team}</span>
                <span className="font-mono-ui text-sm font-semibold text-success">{row.mape}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* floating rank chip */}
      <div className="animate-float-slow absolute -bottom-5 -left-4 z-20 hidden items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-popover md:flex">
        <Activity className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Your team: #4</span>
        <span className="font-mono-ui text-xs text-success">▲ 2</span>
      </div>
    </motion.div>
  )
}

/* Animated grid-beam backdrop (21st.dev cult-ui) tuned to the navy brand palette. */
function HeroBeams() {
  const reduce = useReducedMotion()
  const { canvasRef, rows, cols } = useGridBeam({
    rows: 6,
    cols: 9,
    colorVariant: 'ocean',
    theme: 'light',
    active: !reduce,
    duration: 5,
    strength: 0.9,
    breathe: true,
  })

  return (
    <div className="mask-radial-fade pointer-events-none absolute inset-0" aria-hidden>
      <GridBeamDividers rows={rows} cols={cols} dividerStroke="rgba(31, 78, 140, 0.07)" />
      <GridBeamCanvas ref={canvasRef} />
    </div>
  )
}

function HeroSection({
  audience,
  onAudienceChange,
}: {
  audience: AudienceType
  onAudienceChange: (audience: AudienceType) => void
}) {
  const isProfessor = audience === 'professor'
  const audienceCopy = heroCopy[audience]

  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* backdrop */}
      <div className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_top,rgba(232,240,250,0.9),rgba(247,249,252,0)_60%)]" />
      <HeroBeams />
      <div className="animate-drift-1 absolute -left-24 top-24 h-72 w-72 rounded-full bg-primary-soft blur-3xl" />
      <div className="animate-drift-2 absolute -right-16 top-40 h-80 w-80 rounded-full bg-accent-soft blur-3xl" />

      <div className="relative z-10 mx-auto grid max-w-7xl gap-12 px-4 pb-24 pt-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:px-8 lg:pb-28 lg:pt-20">
        {/* left */}
        <motion.div
          className="max-w-xl"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-xs font-semibold text-text-secondary shadow-card backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Scored on real hotel-market data
            </span>
            <AudienceToggle audience={audience} onAudienceChange={onAudienceChange} />
          </div>

          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.32em] text-text-muted">
            {heroCopy.kicker}
          </p>

          <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-[3.4rem]">
            {isProfessor ? (
              <>
                Run a live forecasting competition your{' '}
                <span className="text-gradient-brand">industry partners</span> would respect.
              </>
            ) : (
              <>
                Forecast like a revenue analyst.{' '}
                <span className="text-gradient-brand">Prove it before you graduate.</span>
              </>
            )}
          </h1>

          <p className="mt-6 text-lg leading-8 text-text-secondary">{audienceCopy.subtext}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={isProfessor ? '/request-demo' : '/register'}>
              <Button size="lg" className="group w-full px-6 shadow-glow sm:w-auto">
                {isProfessor ? 'Request Demo' : 'Register Your Team'}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <Link href={isProfessor ? '#universities' : '#leaderboard'}>
              <Button size="lg" variant="outline" className="w-full px-6 sm:w-auto">
                {isProfessor ? 'See Program Fit' : 'View Leaderboard'}
              </Button>
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            {trustSignals.map((signal) => (
              <div key={signal.label} className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary">
                <signal.icon className="h-4 w-4 text-primary" />
                {signal.label}
              </div>
            ))}
          </div>
        </motion.div>

        {/* right */}
        <div className="lg:pl-4">
          <ForecastConsole />
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* University marquee                                                  */
/* ------------------------------------------------------------------ */

function UniversityMarquee() {
  const items = [...marqueeUniversities, ...marqueeUniversities]

  return (
    <section className="border-b border-border bg-surface-secondary/60 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-text-muted">
          Teams compete from programs across 8 countries
        </p>
        <div className="marquee-mask mt-6 flex overflow-hidden">
          <div className="animate-marquee flex shrink-0 items-center gap-10 pr-10">
            {items.map((name, i) => (
              <span
                key={`${name}-${i}`}
                className="flex items-center gap-2 whitespace-nowrap font-display text-lg font-semibold text-text-muted/80"
              >
                <BarChart3 className="h-4 w-4 text-primary/50" />
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Stats band                                                          */
/* ------------------------------------------------------------------ */

function StatsBand() {
  return (
    <section className="border-b border-border py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-4"
          {...revealProps}
        >
          {heroStats.map((stat) => (
            <div key={stat.label} className="bg-card p-6 transition-colors hover:bg-surface-secondary/60">
              <div className="font-display text-3xl font-semibold text-foreground">{stat.displayValue}</div>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* How it works — connected timeline                                   */
/* ------------------------------------------------------------------ */

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-b border-border bg-surface-secondary/50 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={howItWorksSection.badge}
          title={howItWorksSection.title}
          subtext={howItWorksSection.subtext}
        />
        <div className="relative mt-16">
          <div className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent xl:block" />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {howItWorks.map((step, index) => (
              <motion.div key={step.step} {...revealProps} transition={{ ...sectionTransition, delay: index * 0.08 }}>
                <div className="group relative h-full rounded-2xl border border-border bg-card p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-glow">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-active text-primary-foreground shadow-card transition-transform group-hover:scale-105">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <span className="font-display text-4xl font-semibold text-border">0{step.step}</span>
                  </div>
                  <h3 className="font-display text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Platform preview                                                    */
/* ------------------------------------------------------------------ */

function ProductPreviewTrendChart() {
  const [chartReady, setChartReady] = useState(false)

  useEffect(() => {
    setChartReady(true)
  }, [])

  if (!chartReady) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-border bg-surface-secondary px-6 text-center text-sm text-text-muted">
        Trend lines load in the interactive preview once the page is ready.
      </div>
    )
  }

  return (
    <div className="h-72 min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288}>
        <LineChart data={productPreviewTrendData} margin={{ top: 10, right: 12, left: -12, bottom: 8 }}>
          <CartesianGrid stroke="#d7e3ee" strokeDasharray="3 3" />
          <XAxis dataKey="round" tick={{ fill: '#5f7390', fontSize: 12 }} axisLine={{ stroke: '#d7e3ee' }} tickLine={false} />
          <YAxis
            tick={{ fill: '#5f7390', fontSize: 12 }}
            axisLine={{ stroke: '#d7e3ee' }}
            tickLine={false}
            tickFormatter={(value: number | string) => `${value}%`}
          />
          <Tooltip
            formatter={(value: number | string | undefined) =>
              typeof value === 'number' ? `${value.toFixed(1)}%` : value ?? ''
            }
            contentStyle={{
              borderRadius: '14px',
              border: '1px solid #d7e3ee',
              backgroundColor: '#ffffff',
              boxShadow: '0 18px 40px rgba(17, 38, 71, 0.12)',
            }}
          />
          <Line type="monotone" dataKey="teamMape" stroke="#1f5aa6" strokeWidth={3} dot={{ r: 4, fill: '#1f5aa6' }} name="Team MAPE" />
          <Line type="monotone" dataKey="seasonAverage" stroke="#94a3b8" strokeWidth={2.5} dot={{ r: 3, fill: '#94a3b8' }} name="Season average" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ProductPreviewSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={productPreviewSection.badge}
          eyebrowVariant="info"
          title={productPreviewSection.title}
          subtext={productPreviewSection.subtext}
        />
        <div className="mt-14 grid gap-5">
          <motion.div {...revealProps}>
            <Card className="overflow-hidden border-border">
              <CardHeader className="border-b border-border bg-surface-secondary">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <Badge variant="default" className="mb-3 w-fit">
                      {productPreviewSection.roundBadge}
                    </Badge>
                    <CardTitle className="font-display text-2xl">{productPreviewSection.roundTitle}</CardTitle>
                    <CardDescription className="mt-2 max-w-2xl">{productPreviewSection.roundDescription}</CardDescription>
                  </div>
                  <div className="rounded-full bg-primary-soft px-4 py-2 text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">
                      {productPreviewSection.deadlineLabel}
                    </p>
                    <p className="text-sm font-semibold text-primary">{productPreviewSection.deadlineValue}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5 p-6 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface-secondary p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
                    {productPreviewSection.coverageLabel}
                  </p>
                  <div className="mt-4 flex items-end justify-between gap-4">
                    <div>
                      <p className="font-display text-3xl font-semibold text-foreground">
                        {productPreviewSection.coverageValue}
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">{productPreviewSection.coverageDescription}</p>
                    </div>
                    <Badge variant="success">{productPreviewSection.coverageStatus}</Badge>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-5 shadow-card">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
                        {productPreviewSection.teamSnapshotLabel}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-foreground">{productPreviewSection.teamSnapshotName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
                        {productPreviewSection.teamSnapshotRankLabel}
                      </p>
                      <p className="font-display text-2xl font-semibold text-primary">
                        {productPreviewSection.teamSnapshotRankValue}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-primary-soft px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                        {productPreviewSection.occupancyLabel}
                      </p>
                      <p className="mt-1 text-xl font-semibold text-foreground">{productPreviewSection.occupancyValue}</p>
                    </div>
                    <div className="rounded-lg bg-accent-soft px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                        {productPreviewSection.adrLabel}
                      </p>
                      <p className="mt-1 text-xl font-semibold text-foreground">{productPreviewSection.adrValue}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <motion.div {...revealProps}>
              <Card className="h-full border-border">
                <CardHeader>
                  <Badge variant="success" className="w-fit">
                    {productPreviewSection.trendChartLabel}
                  </Badge>
                  <CardTitle className="font-display text-2xl">{productPreviewSection.trendChartTitle}</CardTitle>
                  <CardDescription>{productPreviewSection.trendChartDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ProductPreviewTrendChart />
                </CardContent>
              </Card>
            </motion.div>

            <div className="grid gap-5">
              <motion.div {...revealProps}>
                <Card variant="subtle" className="border-border">
                  <CardHeader>
                    <Badge variant="warning" className="w-fit">
                      Scoring method
                    </Badge>
                    <CardTitle className="font-display text-2xl">{productPreviewSection.scoringTitle}</CardTitle>
                    <CardDescription>{productPreviewSection.scoringDescription}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {scoringFormula.map((step) => (
                      <div key={step} className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
                        <Target className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                        <p className="text-sm leading-6 text-text-secondary">{step}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div {...revealProps}>
                <Card className="border-border">
                  <CardHeader>
                    <Badge variant="neutral" className="w-fit">
                      Governance
                    </Badge>
                    <CardTitle className="font-display text-2xl">{productPreviewSection.governanceTitle}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {governanceBadges.map((item) => (
                      <div key={item.label} className="flex items-start gap-3 rounded-xl bg-surface-secondary px-4 py-3">
                        <item.icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                        <p className="text-sm leading-6 text-text-secondary">{item.label}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Leaderboard — podium + table                                        */
/* ------------------------------------------------------------------ */

function LeaderboardSection() {
  const podium = leaderboardData.slice(0, 3)
  const tableRows = leaderboardData.slice(3)
  const ordered = [podium[1], podium[0], podium[2]].filter(Boolean)

  return (
    <section id="leaderboard" className="border-y border-border bg-surface-secondary/50 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={leaderboardSection.badge}
          eyebrowVariant="medal"
          title={leaderboardSection.title}
          subtext={leaderboardSection.subtext}
        />

        {/* podium */}
        <div className="mt-14 grid items-end gap-5 sm:grid-cols-3">
          {ordered.map((row) => {
            const isFirst = row.rank === 1
            return (
              <motion.div key={row.rank} {...revealProps} className={isFirst ? 'sm:-mt-6' : ''}>
                <div
                  className={`relative overflow-hidden rounded-2xl border p-6 text-center shadow-card ${
                    isFirst ? 'gradient-border border-transparent bg-card shadow-glow' : 'border-border bg-card'
                  }`}
                >
                  {isFirst ? (
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-medal-gold via-accent to-medal-gold" />
                  ) : null}
                  <div
                    className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold ${
                      row.rank === 1
                        ? 'bg-accent-soft text-medal-gold'
                        : row.rank === 2
                          ? 'bg-muted text-medal-silver'
                          : 'bg-warning-background text-medal-bronze'
                    }`}
                  >
                    {row.rank === 1 ? <Trophy className="h-6 w-6" /> : row.rank}
                  </div>
                  <p className="mt-4 truncate text-base font-semibold text-foreground">{row.team}</p>
                  <p className="mt-1 truncate text-sm text-text-secondary">{row.university}</p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-surface-secondary px-3 py-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">MAPE</span>
                    <span className="font-mono-ui text-sm font-semibold text-success">{row.mape}</span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* table */}
        <motion.div className="mt-6" {...revealProps}>
          <Card className="overflow-hidden border-border">
            <CardHeader className="border-b border-border bg-card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="font-display text-2xl">Round 5 snapshot</CardTitle>
                  <CardDescription className="mt-2">{leaderboardProvocation.supportingLine}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="success">72 / 78 scored</Badge>
                  <Badge variant="info">Illustrative release</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-12 gap-3 border-b border-border bg-surface-secondary px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
                <div className="col-span-1">Rank</div>
                <div className="col-span-4">Team</div>
                <div className="col-span-4">University</div>
                <div className="col-span-3 text-right">Trend / MAPE</div>
              </div>
              <div className="divide-y divide-border">
                {tableRows.map((row) => {
                  const tone = trendTone[row.trend as keyof typeof trendTone] ?? 'text-text-muted'
                  return (
                    <div key={row.rank} className="grid grid-cols-12 gap-3 px-6 py-4 text-sm transition-colors hover:bg-surface-secondary/60">
                      <div className="col-span-1 font-semibold text-foreground">{row.rank}</div>
                      <div className="col-span-4 font-medium text-foreground">{row.team}</div>
                      <div className="col-span-4 text-text-secondary">{row.university}</div>
                      <div className="col-span-3 text-right">
                        <span className={`mr-3 text-xs font-semibold uppercase ${tone}`}>
                          {row.trend === 'same' ? 'Steady' : row.trend}
                        </span>
                        <span className="font-mono-ui font-semibold text-success">{row.mape}</span>
                      </div>
                    </div>
                  )
                })}
                <div className="grid grid-cols-12 items-center gap-3 bg-primary-soft px-6 py-5">
                  <div className="col-span-1 font-display text-lg font-semibold text-primary">?</div>
                  <div className="col-span-8">
                    <p className="font-semibold text-primary">{leaderboardProvocation.headline}</p>
                    <p className="mt-1 text-sm text-text-secondary">{leaderboardProvocation.body}</p>
                  </div>
                  <div className="col-span-3 flex justify-end">
                    <Link href="/register">
                      <Button size="sm" className="group">
                        {leaderboardProvocation.ctaLabel}
                        <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Markets                                                             */
/* ------------------------------------------------------------------ */

function MarketsSection() {
  return (
    <section id="markets" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={marketsSectionContent.badge}
          eyebrowVariant="success"
          title={marketsSectionContent.title}
          subtext={marketsSectionContent.subtext}
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {markets.map((market, index) => (
            <motion.div key={market.name} {...revealProps} transition={{ ...sectionTransition, delay: index * 0.08 }}>
              <Card className="group h-full overflow-hidden border-border transition-all duration-300 hover:-translate-y-1 hover:shadow-glow">
                <div className="h-1.5 bg-gradient-to-r from-primary via-primary to-accent" />
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="font-display text-xl">{market.name}</CardTitle>
                      <CardDescription className="mt-1 text-xs font-semibold uppercase tracking-[0.18em]">
                        {market.country}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-[11px]">
                      {market.signal}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-6 text-text-secondary">{market.desc}</p>
                  <div className="rounded-xl bg-surface-secondary px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Why it matters</p>
                    <p className="mt-2 text-sm text-text-secondary">{market.insight}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Industry bridge — dark rhythm section                               */
/* ------------------------------------------------------------------ */

function IndustryBridgeSection() {
  return (
    <section className="relative overflow-hidden bg-canvas py-24 text-white">
      <div className="bg-grid-dark mask-radial-fade absolute inset-0 opacity-70" />
      <div className="absolute left-1/2 top-0 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-primary/25 blur-[100px]" />
      <div className="animate-pulse-glow absolute bottom-0 right-10 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <motion.div {...revealProps}>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
            {industryBridgeSection.badge}
          </span>
          <h2 className="mx-auto mt-6 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {industryBridgeSection.title}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/70">{industryBridgeSection.body}</p>
        </motion.div>
        <motion.div className="mt-10 flex flex-wrap items-center justify-center gap-3" {...revealProps}>
          {proofStrip.map((item) => (
            <div
              key={item.label}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur"
            >
              <item.icon className="h-4 w-4 text-accent" />
              {item.label}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Testimonials                                                        */
/* ------------------------------------------------------------------ */

function TestimonialsSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={testimonialsSectionContent.badge} eyebrowVariant="success" title={testimonialsSectionContent.title} />
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <motion.div key={testimonial.role} {...revealProps} transition={{ ...sectionTransition, delay: index * 0.08 }}>
              <Card className="h-full border-border transition-all duration-300 hover:-translate-y-1 hover:shadow-glow">
                <CardContent className="flex h-full flex-col gap-6 p-6">
                  <Quote className="h-9 w-9 text-primary/30" />
                  <p className="flex-1 text-base leading-7 text-text-secondary">&ldquo;{testimonial.quote}&rdquo;</p>
                  <div className="flex items-center gap-3 border-t border-border pt-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <testimonial.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{testimonial.role}</p>
                      <p className="text-sm text-text-secondary">{testimonial.context}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* For universities                                                    */
/* ------------------------------------------------------------------ */

function ForUniversitiesSection() {
  return (
    <section id="universities" className="border-y border-border bg-surface-secondary/50 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <motion.div {...revealProps}>
            <Badge variant="warning">{universitiesSection.badge}</Badge>
            <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {universitiesSection.title}
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-text-secondary">{universitiesSection.subtext}</p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {universityFeatures.map((feature) => (
                <Card key={feature.title} className="border-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card">
                  <CardContent className="p-5">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
          <motion.div className="grid gap-5" {...revealProps}>
            <Card className="border-border">
              <CardHeader>
                <Badge variant="info" className="w-fit">
                  Program outcomes
                </Badge>
                <CardTitle className="font-display text-2xl">{programOutcomesSection.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {programOutcomesSection.pillars.map((item) => (
                  <div key={item.title} className="rounded-xl border border-border bg-surface-secondary px-4 py-4">
                    <div className="flex items-start gap-3">
                      <item.icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                      <div className="space-y-1.5">
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="text-sm leading-6 text-text-secondary">{item.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card variant="subtle" className="border-border">
              <CardHeader>
                <Badge variant="neutral" className="w-fit">
                  Competition principles
                </Badge>
                <CardTitle className="font-display text-2xl">Academic, global, and built to last.</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {competitionPrinciples.map((item) => (
                  <div key={item.text} className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-card">
                    <item.icon className="h-4 w-4 flex-shrink-0 text-primary" />
                    <span className="text-sm text-text-secondary">{item.text}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

function FaqSection() {
  const [openItem, setOpenItem] = useState(0)

  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={faqSectionContent.badge}
          eyebrowVariant="neutral"
          title={faqSectionContent.title}
          subtext={faqSectionContent.subtext}
        />
        <div className="mt-12 space-y-3">
          {faqItems.map((item, index) => {
            const open = openItem === index
            return (
              <motion.div key={item.question} {...revealProps}>
                <Card className={`overflow-hidden border-border transition-colors ${open ? 'shadow-card' : ''}`}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left md:px-6"
                    aria-expanded={open}
                    onClick={() => setOpenItem(open ? -1 : index)}
                  >
                    <span className="text-base font-semibold text-foreground">{item.question}</span>
                    <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-colors ${open ? 'bg-primary text-primary-foreground' : 'bg-surface-secondary text-text-muted'}`}>
                      {open ? <Minus className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border px-5 pb-5 pt-4 md:px-6">
                          <p className="text-sm leading-7 text-text-secondary">{item.answer}</p>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Final CTA                                                           */
/* ------------------------------------------------------------------ */

function FinalCtaSection({ audience }: { audience: AudienceType }) {
  const isProfessor = audience === 'professor'
  const audienceCopy = finalCtaSection[audience]

  return (
    <section className="pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-canvas px-6 py-12 text-white shadow-glow md:px-12 md:py-16">
          <div className="bg-grid-dark mask-radial-fade absolute inset-0 opacity-60" />
          <div className="absolute -left-10 top-0 h-64 w-64 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute -bottom-10 right-0 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-accent backdrop-blur">
                {finalCtaSection.badge}
              </span>
              <h2 className="max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                {audienceCopy.headline}
              </h2>
              <p className="flex items-center gap-2 text-sm font-semibold text-accent">
                <ArrowUpRight className="h-4 w-4" />
                {audienceCopy.urgency}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link href={isProfessor ? '/request-demo' : '/register'}>
                <Button size="lg" className="w-full bg-white px-6 text-primary hover:bg-white/90">
                  {isProfessor ? 'Request Demo' : 'Create Account'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="w-full border-white/25 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

function FooterNavLink({ href, label }: { href: string; label: string }) {
  return href.startsWith('mailto:') ? (
    <a href={href} className="transition-colors hover:text-foreground">
      {label}
    </a>
  ) : (
    <Link href={href} className="transition-colors hover:text-foreground">
      {label}
    </Link>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-secondary/60 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <BrandLockup />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-secondary">
            {footerLinks.primary.map((link) => (
              <FooterNavLink key={link.href} href={link.href} label={link.label} />
            ))}
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-4 border-t border-border pt-6 text-sm text-text-secondary lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {footerLinks.secondary.map((link) => (
              <FooterNavLink key={link.href} href={link.href} label={link.label} />
            ))}
          </div>
          <p>&copy; {brand.year} RevME Forecaster Cup. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LandingPage({ heroStatusLabel }: { heroStatusLabel: string }) {
  const [audience, setAudience] = useState<AudienceType>('student')

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AnnouncementBar heroStatusLabel={heroStatusLabel} />
      <SiteHeader audience={audience} />
      <main>
        <HeroSection audience={audience} onAudienceChange={setAudience} />
        <UniversityMarquee />
        <StatsBand />
        <HowItWorksSection />
        <ProductPreviewSection />
        <LeaderboardSection />
        <MarketsSection />
        <IndustryBridgeSection />
        <TestimonialsSection />
        <ForUniversitiesSection />
        <FaqSection />
        <FinalCtaSection audience={audience} />
      </main>
      <SiteFooter />
    </div>
  )
}
