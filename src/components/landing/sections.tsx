"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, BarChart3, ChevronDown, Menu, Minus, Quote, Target, X } from 'lucide-react'
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
import {
  brand,
  competitionPrinciples,
  countdownClosedText,
  countdownDeadline,
  faqItems,
  faqSection as faqSectionContent,
  finalCtaSection,
  footerLinks,
  governanceBadges,
  heroBadge,
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

function getCountdownText(deadlineIso: string) {
  const deadline = new Date(deadlineIso).getTime()
  const diff = deadline - Date.now()

  if (Number.isNaN(deadline) || diff <= 0) {
    return countdownClosedText
  }

  const totalHours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  const dayLabel = days === 1 ? 'day' : 'days'
  const hourLabel = hours === 1 ? 'hour' : 'hours'

  return `${heroBadge.label} — Round 1 Closes in ${days} ${dayLabel}, ${hours} ${hourLabel}`
}

function BrandLockup() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-card">
        <BarChart3 className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <div className="font-display text-[1.75rem] font-semibold text-foreground">{brand.name}</div>
        <div className="text-[11px] uppercase tracking-[0.28em] text-text-muted">{brand.tagline}</div>
      </div>
    </div>
  )
}

function AudienceToggle({
  audience,
  onAudienceChange,
}: {
  audience: AudienceType
  onAudienceChange: (audience: AudienceType) => void
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-surface p-1 shadow-card">
      {(['student', 'professor'] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onAudienceChange(value)}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            audience === value ? 'bg-primary text-primary-foreground' : 'text-text-secondary hover:text-foreground'
          }`}
        >
          {value === 'student' ? "I'm a student" : "I'm a professor"}
        </button>
      ))}
    </div>
  )
}

function SiteHeader({ audience }: { audience: AudienceType }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const primaryHref = audience === 'professor' ? '/request-demo' : '/register'
  const primaryLabel = audience === 'professor' ? 'Request Demo' : 'Create Account'

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileMenuOpen])

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="shrink-0">
            <BrandLockup />
          </Link>
          <nav className="hidden items-center gap-7 lg:flex">
            {sectionLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 lg:flex">
              <Link href="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href={primaryHref}>
                <Button>{primaryLabel}</Button>
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
              className="absolute inset-0 bg-slate-950/45"
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

function HeroSection({
  audience,
  onAudienceChange,
}: {
  audience: AudienceType
  onAudienceChange: (audience: AudienceType) => void
}) {
  const [countdownLabel, setCountdownLabel] = useState(() => getCountdownText(countdownDeadline))
  const isProfessor = audience === 'professor'
  const audienceCopy = heroCopy[audience]

  useEffect(() => {
    setCountdownLabel(getCountdownText(countdownDeadline))
    const intervalId = window.setInterval(() => {
      setCountdownLabel(getCountdownText(countdownDeadline))
    }, 60000)

    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_top_left,rgba(232,240,250,0.92),rgba(247,249,252,0)_58%)]" />
      <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-primary-soft blur-3xl" />
      <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-accent-soft blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-14 sm:px-6 lg:px-8 lg:pb-28 lg:pt-20">
        <motion.div className="mx-auto max-w-3xl space-y-8 text-center" {...revealProps}>
          <div className="space-y-5">
            <Badge variant="info" className="mx-auto inline-flex gap-2 px-3 py-1.5">
              <heroBadge.icon className="h-3.5 w-3.5" />
              {countdownLabel}
            </Badge>
            <AudienceToggle audience={audience} onAudienceChange={onAudienceChange} />
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-text-muted">{heroCopy.kicker}</p>
              <h1 className="font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl">
                {audienceCopy.headline}
              </h1>
              <p className="text-lg leading-8 text-text-secondary">{audienceCopy.subtext}</p>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href={isProfessor ? '/request-demo' : '/register'}>
              <Button size="lg" className="w-full sm:w-auto">
                {isProfessor ? 'Request Demo' : 'Register Now'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href={isProfessor ? '#universities' : '#leaderboard'}>
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                {isProfessor ? 'See Program Fit' : 'View Leaderboard'}
              </Button>
            </Link>
          </div>
        </motion.div>

        <motion.div className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-3" {...revealProps}>
          {trustSignals.map((signal) => (
            <div
              key={signal.label}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-text-secondary shadow-card"
            >
              <signal.icon className="h-4 w-4 text-primary" />
              {signal.label}
            </div>
          ))}
        </motion.div>

        <motion.div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 xl:grid-cols-4" {...revealProps}>
          {heroStats.map((stat) => (
            <Card key={stat.label} variant="metric" className="border-border">
              <CardContent className="p-5">
                <div className="font-display text-3xl font-semibold text-foreground">{stat.displayValue}</div>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-text-muted">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      </div>
      <div className="mx-auto flex max-w-7xl items-center justify-center pb-8 text-text-muted">
        <ChevronDown className="h-5 w-5 animate-bounce" />
      </div>
    </section>
  )
}

function SocialProofStrip() {
  return (
    <section className="border-b border-border bg-surface-secondary py-6">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        {proofStrip.map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 shadow-card">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
              <item.icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-text-secondary">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-y border-border bg-surface-secondary py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div className="mx-auto max-w-3xl text-center" {...revealProps}>
          <Badge variant="default">{howItWorksSection.badge}</Badge>
          <h2 className="mt-5 font-display text-4xl font-semibold text-foreground">{howItWorksSection.title}</h2>
          <p className="mt-4 text-lg leading-8 text-text-secondary">{howItWorksSection.subtext}</p>
        </motion.div>
        <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {howItWorks.map((step) => (
            <motion.div key={step.step} {...revealProps}>
              <Card className="h-full border-border bg-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono-ui text-sm font-semibold text-text-muted">0{step.step}</span>
                  </div>
                  <CardTitle>{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-text-secondary">{step.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

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
          <XAxis
            dataKey="round"
            tick={{ fill: '#5f7390', fontSize: 12 }}
            axisLine={{ stroke: '#d7e3ee' }}
            tickLine={false}
          />
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
          <Line
            type="monotone"
            dataKey="teamMape"
            stroke="#1f5aa6"
            strokeWidth={3}
            dot={{ r: 4, fill: '#1f5aa6' }}
            name="Team MAPE"
          />
          <Line
            type="monotone"
            dataKey="seasonAverage"
            stroke="#94a3b8"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#94a3b8' }}
            name="Season average"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ProductPreviewSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div className="mx-auto max-w-3xl text-center" {...revealProps}>
          <Badge variant="info">{productPreviewSection.badge}</Badge>
          <h2 className="mt-5 font-display text-4xl font-semibold text-foreground">{productPreviewSection.title}</h2>
          <p className="mt-4 text-lg leading-8 text-text-secondary">{productPreviewSection.subtext}</p>
        </motion.div>
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

function LeaderboardSection() {
  const podium = leaderboardData.slice(0, 3)
  const tableRows = leaderboardData.slice(3)

  return (
    <section id="leaderboard" className="border-y border-border bg-surface-secondary py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div className="mx-auto max-w-3xl text-center" {...revealProps}>
          <Badge variant="medal">{leaderboardSection.badge}</Badge>
          <h2 className="mt-5 font-display text-4xl font-semibold text-foreground">{leaderboardSection.title}</h2>
          <p className="mt-4 text-lg leading-8 text-text-secondary">{leaderboardSection.subtext}</p>
        </motion.div>
        <div className="mt-14 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="grid gap-5">
            {podium.map((row) => (
              <motion.div key={row.rank} {...revealProps}>
                <Card className="border-border">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold ${
                        row.rank === 1
                          ? 'bg-accent-soft text-medal-gold'
                          : row.rank === 2
                            ? 'bg-surface-secondary text-medal-silver'
                            : 'bg-warning-background text-medal-bronze'
                      }`}
                    >
                      {row.rank}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-foreground">{row.team}</p>
                      <p className="truncate text-sm text-text-secondary">{row.university}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">MAPE</p>
                      <p className="text-lg font-semibold text-success">{row.mape}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
          <motion.div {...revealProps}>
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
                      <div key={row.rank} className="grid grid-cols-12 gap-3 px-6 py-4 text-sm">
                        <div className="col-span-1 font-semibold text-foreground">{row.rank}</div>
                        <div className="col-span-4 font-medium text-foreground">{row.team}</div>
                        <div className="col-span-4 text-text-secondary">{row.university}</div>
                        <div className="col-span-3 text-right">
                          <span className={`mr-3 text-xs font-semibold uppercase ${tone}`}>
                            {row.trend === 'same' ? 'Steady' : row.trend}
                          </span>
                          <span className="font-semibold text-success">{row.mape}</span>
                        </div>
                      </div>
                    )
                  })}
                  <div className="grid grid-cols-12 gap-3 bg-primary-soft px-6 py-4">
                    <div className="col-span-1 font-semibold text-primary">?</div>
                    <div className="col-span-8">
                      <p className="font-medium text-primary">{leaderboardProvocation.headline}</p>
                      <p className="mt-1 text-sm text-text-secondary">{leaderboardProvocation.body}</p>
                    </div>
                    <div className="col-span-3 flex justify-end">
                      <Link href="/register">
                        <Button size="sm">{leaderboardProvocation.ctaLabel}</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function MarketsSection() {
  return (
    <section id="markets" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div className="mx-auto max-w-3xl text-center" {...revealProps}>
          <Badge variant="success">{marketsSectionContent.badge}</Badge>
          <h2 className="mt-5 font-display text-4xl font-semibold text-foreground">{marketsSectionContent.title}</h2>
          <p className="mt-4 text-lg leading-8 text-text-secondary">{marketsSectionContent.subtext}</p>
        </motion.div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {markets.map((market) => (
            <motion.div key={market.name} {...revealProps}>
              <Card className="h-full overflow-hidden border-border">
                <div className="h-1.5 bg-gradient-to-r from-primary to-accent" />
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{market.name}</CardTitle>
                      <CardDescription className="mt-2">{market.country}</CardDescription>
                    </div>
                    <Badge variant="secondary">{market.signal}</Badge>
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

function IndustryBridgeSection() {
  return (
    <section className="border-y border-border bg-primary-soft/35 py-16">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        <motion.div {...revealProps}>
          <Badge variant="info">{industryBridgeSection.badge}</Badge>
          <h2 className="mt-5 font-display text-3xl font-semibold text-foreground sm:text-4xl">
            {industryBridgeSection.title}
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-text-secondary">{industryBridgeSection.body}</p>
        </motion.div>
      </div>
    </section>
  )
}

function TestimonialsSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div className="mx-auto max-w-3xl text-center" {...revealProps}>
          <Badge variant="success">{testimonialsSectionContent.badge}</Badge>
          <h2 className="mt-5 font-display text-4xl font-semibold text-foreground">{testimonialsSectionContent.title}</h2>
        </motion.div>
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <motion.div key={testimonial.name} {...revealProps}>
              <Card className="h-full border-border">
                <CardContent className="flex h-full flex-col gap-6 p-6">
                  <Quote className="h-9 w-9 text-primary/35" />
                  <p className="flex-1 text-base leading-7 text-text-secondary">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                  <div className="border-t border-border pt-4">
                    <p className="font-semibold text-foreground">{testimonial.name}</p>
                    <p className="text-sm text-text-secondary">{testimonial.role}</p>
                    <p className="mt-1 text-sm text-text-muted">{testimonial.university}</p>
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

function ForUniversitiesSection() {
  return (
    <section id="universities" className="border-y border-border bg-surface-secondary py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <motion.div {...revealProps}>
            <Badge variant="warning">{universitiesSection.badge}</Badge>
            <h2 className="mt-5 font-display text-4xl font-semibold text-foreground">{universitiesSection.title}</h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-text-secondary">{universitiesSection.subtext}</p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {universityFeatures.map((feature) => (
                <Card key={feature.title} className="border-border bg-card">
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
                    <item.icon className="h-4 w-4 text-primary" />
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

function FaqSection() {
  const [openItem, setOpenItem] = useState(0)

  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div className="mx-auto max-w-3xl text-center" {...revealProps}>
          <Badge variant="neutral">{faqSectionContent.badge}</Badge>
          <h2 className="mt-5 font-display text-4xl font-semibold text-foreground">{faqSectionContent.title}</h2>
          <p className="mt-4 text-lg leading-8 text-text-secondary">{faqSectionContent.subtext}</p>
        </motion.div>
        <div className="mt-12 space-y-4">
          {faqItems.map((item, index) => {
            const open = openItem === index

            return (
              <motion.div key={item.question} {...revealProps}>
                <Card className="border-border">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left md:px-6"
                    aria-expanded={open}
                    onClick={() => setOpenItem(open ? -1 : index)}
                  >
                    <span className="text-base font-semibold text-foreground">{item.question}</span>
                    {open ? (
                      <Minus className="h-4 w-4 flex-shrink-0 text-text-muted" />
                    ) : (
                      <ChevronDown className="h-4 w-4 flex-shrink-0 text-text-muted" />
                    )}
                  </button>
                  {open ? (
                    <CardContent className="border-t border-border pt-5">
                      <p className="text-sm leading-7 text-text-secondary">{item.answer}</p>
                    </CardContent>
                  ) : null}
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function FinalCtaSection({ audience }: { audience: AudienceType }) {
  const isProfessor = audience === 'professor'
  const audienceCopy = finalCtaSection[audience]

  return (
    <section className="pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden border-border bg-gradient-to-br from-card via-card to-primary-soft">
          <CardContent className="grid gap-8 p-8 md:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="space-y-4">
              <Badge variant="medal" className="w-fit">
                {finalCtaSection.badge}
              </Badge>
              <h2 className="max-w-4xl font-display text-4xl font-semibold text-foreground">{audienceCopy.headline}</h2>
              <p className="text-sm font-semibold text-primary">{audienceCopy.urgency}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link href={isProfessor ? '/request-demo' : '/register'}>
                <Button size="lg" className="w-full">
                  {isProfessor ? 'Request Demo' : 'Create Account'}
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="w-full">
                  Sign In
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

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
    <footer className="border-t border-border bg-surface-secondary py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-card">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-foreground">{brand.name}</p>
              <p className="text-xs uppercase tracking-[0.24em] text-text-muted">{brand.tagline}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-secondary">
            {footerLinks.primary.map((link) => (
              <FooterNavLink key={link.href} href={link.href} label={link.label} />
            ))}
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-4 border-t border-border pt-6 text-sm text-text-secondary lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {footerLinks.secondary.map((link) => (
              <FooterNavLink key={link.href} href={link.href} label={link.label} />
            ))}
          </div>
          <p>&copy; 2026 RevME Forecaster Cup. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

export function LandingPage() {
  const [audience, setAudience] = useState<AudienceType>('student')

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader audience={audience} />
      <main>
        <HeroSection audience={audience} onAudienceChange={setAudience} />
        <SocialProofStrip />
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
