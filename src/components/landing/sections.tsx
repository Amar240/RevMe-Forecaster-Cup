"use client"

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Globe2,
  GraduationCap,
  Lock,
  Minus,
  Shield,
  Target,
  Trophy,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  brand,
  faqItems,
  governanceBadges,
  heroBadge,
  heroStats,
  howItWorks,
  leaderboardData,
  markets,
  scoringFormula,
  trustSignals,
  universityFeatures,
} from '@/data/landing'

type AudienceType = 'student' | 'professor'

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.45, ease: 'easeOut' as const },
}

const sectionLinks = [
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#leaderboard', label: 'Leaderboard' },
  { href: '#markets', label: 'Markets' },
  { href: '#universities', label: 'For Universities' },
]

const proofStrip = [
  { label: 'International cohort-ready', icon: Globe2 },
  { label: 'Weekly governed scoring', icon: Target },
  { label: 'Transparent leaderboard updates', icon: Trophy },
  { label: 'Secure institutional setup', icon: Shield },
]

const trendTone = {
  up: 'text-success',
  same: 'text-warning',
  down: 'text-text-muted',
} as const

function BrandLockup() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-card">
        <BarChart3 className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <div className="font-display text-[1.75rem] font-semibold text-foreground">{brand.name}</div>
        <div className="text-[11px] uppercase tracking-[0.28em] text-text-muted">Forecaster Cup</div>
      </div>
    </div>
  )
}

function SiteHeader({ audience }: { audience: AudienceType }) {
  const primaryHref = audience === 'professor' ? '/request-demo' : '/register'
  const primaryLabel = audience === 'professor' ? 'Request Demo' : 'Create Account'

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background backdrop-blur">
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
          <Link href="/login">
            <Button variant="ghost" className="hidden sm:inline-flex">
              Sign In
            </Button>
          </Link>
          <Link href={primaryHref}>
            <Button>{primaryLabel}</Button>
          </Link>
        </div>
      </div>
    </header>
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
      <button
        type="button"
        onClick={() => onAudienceChange('student')}
        className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
          audience === 'student'
            ? 'bg-primary text-primary-foreground'
            : 'text-text-secondary hover:text-foreground'
        }`}
      >
        I&apos;m a student
      </button>
      <button
        type="button"
        onClick={() => onAudienceChange('professor')}
        className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
          audience === 'professor'
            ? 'bg-primary text-primary-foreground'
            : 'text-text-secondary hover:text-foreground'
        }`}
      >
        I&apos;m a professor
      </button>
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

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_top_left,rgba(232,240,250,0.92),rgba(247,249,252,0)_58%)]" />
      <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-primary-soft blur-3xl" />
      <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-accent-soft blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-24 pt-14 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:pb-28 lg:pt-20">
        <motion.div className="space-y-8" {...reveal}>
          <div className="space-y-5">
            <Badge variant="info" className="gap-2 px-3 py-1.5">
              <heroBadge.icon className="h-3.5 w-3.5" />
              {heroBadge.text}
            </Badge>

            <AudienceToggle audience={audience} onAudienceChange={onAudienceChange} />

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-text-muted">
                Forecasting competition platform
              </p>
              <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl">
                Forecast hospitality demand with the discipline of a real analytics program.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-text-secondary">
                {isProfessor
                  ? 'Run a governed international forecasting competition for your cohort with secure submissions, transparent scoring, and operational controls that hold up in a real academic setting.'
                  : 'Join a global forecasting challenge built around real markets, weekly deadlines, transparent MAPE scoring, and a leaderboard that rewards accuracy over noise.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
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

          <div className="flex flex-wrap gap-3">
            {trustSignals.map((signal) => (
              <div
                key={signal.label}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-text-secondary shadow-card"
              >
                <signal.icon className="h-4 w-4 text-primary" />
                {signal.label}
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {heroStats.map((stat) => (
              <Card key={stat.label} variant="metric" className="border-border">
                <CardContent className="p-5">
                  <div className="font-display text-3xl font-semibold text-foreground">
                    {stat.prefix}
                    {stat.value}
                  </div>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-text-muted">
                    {stat.label}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        <motion.div className="grid gap-5 lg:pt-8" {...reveal}>
          <Card className="overflow-hidden border-border">
            <CardHeader className="border-b border-border bg-surface-secondary">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Badge variant="default" className="mb-3">
                    Current round
                  </Badge>
                  <CardTitle className="font-display text-2xl">Round 3 Forecast Window</CardTitle>
                  <CardDescription className="mt-2 max-w-lg">
                    Teams are forecasting occupancy and ADR across three active hotel markets with a single weekly deadline.
                  </CardDescription>
                </div>
                <div className="rounded-full bg-primary-soft px-4 py-2 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">
                    Deadline
                  </p>
                  <p className="text-sm font-semibold text-primary">Sat, Mar 21, 11:59 PM ET</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5 p-6 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-surface-secondary p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Forecast coverage</p>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="font-display text-3xl font-semibold text-foreground">72 / 78</p>
                    <p className="mt-1 text-sm text-text-secondary">Scored points published this week</p>
                  </div>
                  <Badge variant="success">Ready to release</Badge>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Team snapshot</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">Forecast Masters</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Rank</p>
                    <p className="font-display text-2xl font-semibold text-primary">#4</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-primary-soft px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Occupancy MAPE</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">8.4%</p>
                  </div>
                  <div className="rounded-lg bg-accent-soft px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">ADR MAPE</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">8.9%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
            <Card variant="subtle" className="border-border">
              <CardHeader>
                <Badge variant="warning" className="w-fit">
                  Scoring method
                </Badge>
                <CardTitle className="font-display text-2xl">Transparent, governed, and easy to explain.</CardTitle>
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

            <Card className="border-border">
              <CardHeader>
                <Badge variant="neutral" className="w-fit">
                  Governance
                </Badge>
                <CardTitle className="font-display text-2xl">Built for credible competition operations.</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {governanceBadges.map((badge) => (
                  <div key={badge.label} className="flex items-start gap-3 rounded-xl bg-surface-secondary px-4 py-3">
                    <badge.icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <p className="text-sm leading-6 text-text-secondary">{badge.label}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
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
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 shadow-card"
          >
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
    <section id="how-it-works" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div className="mx-auto max-w-3xl text-center" {...reveal}>
          <Badge variant="default">How it works</Badge>
          <h2 className="mt-5 font-display text-4xl font-semibold text-foreground">
            A real forecasting competition, not a classroom toy.
          </h2>
          <p className="mt-4 text-lg leading-8 text-text-secondary">
            Every week follows the same clean operating cycle: register, forecast, score, and learn from published results.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {howItWorks.map((step) => (
            <motion.div key={step.step} {...reveal}>
              <Card className="h-full border-border">
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

function LeaderboardSection() {
  const podium = leaderboardData.slice(0, 3)
  const tableRows = leaderboardData.slice(3)

  return (
    <section id="leaderboard" className="border-y border-border bg-surface-secondary py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div className="mx-auto max-w-3xl text-center" {...reveal}>
          <Badge variant="medal">Leaderboard preview</Badge>
          <h2 className="mt-5 font-display text-4xl font-semibold text-foreground">
            Publish standings that feel credible the moment students see them.
          </h2>
          <p className="mt-4 text-lg leading-8 text-text-secondary">
            Ranking updates are framed like a real analytics release: clear scope, clear scoring, clear movement.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="grid gap-5">
            {podium.map((row) => (
              <Card key={row.rank} className="border-border">
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
            ))}
          </div>

          <Card className="overflow-hidden border-border">
            <CardHeader className="border-b border-border bg-card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="font-display text-2xl">Round 5 snapshot</CardTitle>
                  <CardDescription className="mt-2">
                    Published after actuals review with 72 scored points and zero unresolved anomalies.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="success">72 / 78 scored</Badge>
                  <Badge variant="info">Latest release</Badge>
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
                    <p className="font-medium text-primary">Your team could be here next release.</p>
                    <p className="text-sm text-text-secondary">Register, forecast, and publish your first scored round.</p>
                  </div>
                  <div className="col-span-3 flex justify-end">
                    <Link href="/register">
                      <Button size="sm">Join the competition</Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

function MarketsSection() {
  return (
    <section id="markets" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div className="mx-auto max-w-3xl text-center" {...reveal}>
          <Badge variant="success">Active markets</Badge>
          <h2 className="mt-5 font-display text-4xl font-semibold text-foreground">
            Students forecast live hospitality markets with different demand signatures.
          </h2>
          <p className="mt-4 text-lg leading-8 text-text-secondary">
            The challenge is intentionally varied so teams learn to reason through business, tourism, and event-driven volatility.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {markets.map((market) => (
            <motion.div key={market.name} {...reveal}>
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
                    <p className="mt-2 text-sm text-text-secondary">
                      Teams learn to explain their forecast decisions, not just upload numbers.
                    </p>
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
          <motion.div {...reveal}>
            <Badge variant="warning">For universities</Badge>
            <h2 className="mt-5 font-display text-4xl font-semibold text-foreground">
              A competition platform that respects academic standards and operational reality.
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-text-secondary">
              RevME is designed to feel credible to faculty, engaging to students, and maintainable for programs that want to run forecasting cohorts year after year.
            </p>

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

          <motion.div className="grid gap-5" {...reveal}>
            <Card className="border-border">
              <CardHeader>
                <Badge variant="info" className="w-fit">
                  Program fit
                </Badge>
                <CardTitle className="font-display text-2xl">What stakeholders get</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border bg-surface-secondary px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-primary" />
                    <p className="font-medium text-foreground">Faculty see governed operations and auditable results.</p>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-surface-secondary px-4 py-4">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    <p className="font-medium text-foreground">Students get a competitive analytics experience, not a static assignment.</p>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-surface-secondary px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Clock3 className="h-5 w-5 text-primary" />
                    <p className="font-medium text-foreground">Administrators keep each round repeatable, reviewable, and scalable.</p>
                  </div>
                </div>
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
                <div className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-card">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm text-text-secondary">Designed for cohorts, teams, supervisors, and institutional oversight.</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-card">
                  <Lock className="h-4 w-4 text-primary" />
                  <span className="text-sm text-text-secondary">Submission windows, role controls, and audit history stay explicit.</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-card">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm text-text-secondary">Each season can be rerun without rebuilding the workflow from scratch.</span>
                </div>
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
        <motion.div className="mx-auto max-w-3xl text-center" {...reveal}>
          <Badge variant="neutral">FAQ</Badge>
          <h2 className="mt-5 font-display text-4xl font-semibold text-foreground">
            Clear rules, clear scoring, clear expectations.
          </h2>
          <p className="mt-4 text-lg leading-8 text-text-secondary">
            The public competition story should be easy to understand before anyone joins a team.
          </p>
        </motion.div>

        <div className="mt-12 space-y-4">
          {faqItems.map((item, index) => {
            const open = openItem === index
            return (
              <motion.div key={item.question} {...reveal}>
                <Card className="border-border">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left md:px-6"
                    onClick={() => setOpenItem(open ? -1 : index)}
                  >
                    <span className="text-base font-semibold text-foreground">{item.question}</span>
                    {open ? (
                      <Minus className="h-4 w-4 flex-shrink-0 text-text-muted" />
                    ) : (
                      <ChevronDown className="h-4 w-4 flex-shrink-0 text-text-muted" />
                    )}
                  </button>
                  {open && (
                    <CardContent className="border-t border-border pt-5">
                      <p className="text-sm leading-7 text-text-secondary">{item.answer}</p>
                    </CardContent>
                  )}
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

  return (
    <section className="pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden border-border bg-gradient-to-br from-card via-card to-primary-soft">
          <CardContent className="grid gap-8 p-8 md:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="space-y-4">
              <Badge variant="medal" className="w-fit">
                Ready to start
              </Badge>
              <h2 className="font-display text-4xl font-semibold text-foreground">
                Bring a forecasting competition to life without sacrificing clarity or credibility.
              </h2>
              <p className="max-w-3xl text-lg leading-8 text-text-secondary">
                {isProfessor
                  ? 'See how RevME can support your program, scoring workflow, and student engagement from the first round through the final leaderboard.'
                  : 'Join the next cohort, forecast real markets, and see how your team performs against students from programs around the world.'}
              </p>
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

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-secondary py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-card">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-lg font-semibold text-foreground">{brand.name}</p>
            <p className="text-xs uppercase tracking-[0.24em] text-text-muted">Forecaster Cup</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-secondary">
          <Link href="/login" className="transition-colors hover:text-foreground">
            Sign In
          </Link>
          <Link href="/register" className="transition-colors hover:text-foreground">
            Register
          </Link>
          <Link href="/request-demo" className="transition-colors hover:text-foreground">
            Request Demo
          </Link>
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
        <LeaderboardSection />
        <MarketsSection />
        <ForUniversitiesSection />
        <FaqSection />
        <FinalCtaSection audience={audience} />
      </main>
      <SiteFooter />
    </div>
  )
}
