"use client"

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  Trophy,
  ChevronDown,
  Building2,
  Users,
  GraduationCap,
  ArrowUpRight,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Minus,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CountUp } from '@/components/landing/CountUp'
import {
  fadeInUp,
  slideFromLeft,
  slideFromRight,
  scaleIn,
  staggerContainer,
  staggerFast,
  staggerSlow,
} from '@/components/landing/animations'
import {
  heroStats,
  trustSignals,
  leaderboardData,
  howItWorks,
  markets,
  heroBadge,
  brand,
  universityFeatures,
  scoringFormula,
  governanceBadges,
  faqItems,
} from '@/data/landing'

type AudienceType = 'student' | 'professor'

/* ─────────────────────────── HEADER ─────────────────────────── */

export function SiteHeader({ audience }: { audience: AudienceType }) {
  const isProfessor = audience === 'professor'

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-canvas/70 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-xl font-semibold text-white font-display">{brand.name}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Forecaster Cup</div>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            <a href="#how-it-works" className="text-slate-400 hover:text-white transition-colors text-sm">How It Works</a>
            <a href="#leaderboard" className="text-slate-400 hover:text-white transition-colors text-sm">Leaderboard</a>
            <a href="#markets" className="text-slate-400 hover:text-white transition-colors text-sm">Markets</a>
            <a href="#universities" className="text-slate-400 hover:text-white transition-colors text-sm">For Universities</a>
          </nav>

          <div className="flex items-center space-x-3">
            <Link href="/login">
              <Button variant="ghost" className="text-slate-400 hover:text-white hover:bg-white/5">Sign In</Button>
            </Link>
            <Link href={isProfessor ? '/request-demo' : '/register'}>
              <Button className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white border-0 shadow-lg shadow-violet-500/20">
                {isProfessor ? 'Request Demo' : 'Join Now'}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

/* ─────────────────────────── HERO ─────────────────────────── */

export function HeroSection({
  audience,
  onAudienceChange,
}: {
  audience: AudienceType
  onAudienceChange: (a: AudienceType) => void
}) {
  const isProfessor = audience === 'professor'

  return (
    <section className="relative min-h-screen overflow-hidden bg-canvas pt-16">
      {/* Gradient mesh orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-violet-600/20 blur-[120px] orb-drift-1" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full bg-amber-500/15 blur-[100px] orb-drift-2" />
        <div className="absolute bottom-0 left-1/4 w-[350px] h-[350px] rounded-full bg-blue-500/15 blur-[100px] orb-drift-3" />
      </div>

      {/* Grain overlay */}
      <div className="absolute inset-0 grain-overlay pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20 relative">
        <motion.div
          className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          {/* Left column */}
          <motion.div variants={fadeInUp} className="space-y-7">
            {/* Badge */}
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/20">
              <heroBadge.icon className="h-3.5 w-3.5 text-amber-400" />
              {heroBadge.text}
            </motion.div>

            {/* Audience toggle */}
            <motion.div variants={fadeInUp} className="inline-flex rounded-full p-1 glass-card">
              <button
                type="button"
                onClick={() => onAudienceChange('student')}
                aria-pressed={!isProfessor}
                className={`px-5 py-2 text-xs font-semibold rounded-full transition-all ${
                  !isProfessor
                    ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-500/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                I&apos;m a Student
              </button>
              <button
                type="button"
                onClick={() => onAudienceChange('professor')}
                aria-pressed={isProfessor}
                className={`px-5 py-2 text-xs font-semibold rounded-full transition-all ${
                  isProfessor
                    ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-500/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                I&apos;m a Professor
              </button>
            </motion.div>

            {/* Headline */}
            <motion.h1 variants={fadeInUp} className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-[1.1] tracking-tight font-display">
              The Global Hotel{' '}
              <br className="hidden sm:block" />
              Forecasting{' '}
              <span className="text-gradient-primary">Championship</span>
            </motion.h1>

            {/* Sub-headline */}
            <motion.p variants={fadeInUp} className="text-lg sm:text-xl text-slate-400 max-w-lg leading-relaxed">
              {isProfessor
                ? 'Give your cohort a governed competition with audit-ready scoring and transparent rankings.'
                : 'Predict. Compete. Prove your accuracy across 7 rounds of real hotel market data.'}
            </motion.p>

            {/* CTAs */}
            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4">
              <Link href="/register">
                <Button size="lg" className="text-base px-8 py-6 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white shadow-xl shadow-violet-500/25 animate-pulse-glow">
                  {isProfessor ? <Building2 className="h-5 w-5 mr-2" /> : <GraduationCap className="h-5 w-5 mr-2" />}
                  {isProfessor ? 'Register University' : 'Create Account'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link href={isProfessor ? '/request-demo' : '/leaderboards'}>
                <Button size="lg" variant="outline" className="text-base px-8 py-6 border-white/10 text-slate-300 hover:bg-white/5 hover:text-white gradient-border">
                  {isProfessor ? 'Request Demo' : 'View Leaderboard'}
                </Button>
              </Link>
            </motion.div>

            {/* Trust signals */}
            <motion.div variants={fadeInUp} className="flex flex-wrap gap-3">
              {trustSignals.map((signal) => (
                <div key={signal.label} className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium glass-card text-slate-400">
                  <signal.icon className="h-3.5 w-3.5 text-emerald-400" />
                  {signal.label}
                </div>
              ))}
            </motion.div>

            {/* Stats */}
            <motion.div variants={fadeInUp} className="flex flex-wrap gap-8 pt-2">
              {heroStats.map((stat) => (
                <div key={stat.label}>
                  <div className="flex items-baseline">
                    {stat.prefix && <span className="text-2xl font-bold text-gradient-gold">{stat.prefix}</span>}
                    <CountUp value={stat.value} />
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right column – floating cards */}
          <motion.div variants={slideFromRight} className="space-y-5 hidden lg:block">
            {/* Live Round card */}
            <motion.div
              className="glass-card rounded-2xl p-6 shadow-2xl shadow-violet-500/5 animate-float"
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Live round</p>
                  <h3 className="text-lg font-semibold text-white mt-1">Round 3 Forecast Window</h3>
                </div>
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">Open</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-[11px] text-slate-500">Occupancy</p>
                  <div className="text-2xl font-bold text-white mt-1">74.2</div>
                  <div className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3" />
                    steady
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-[11px] text-slate-500">ADR</p>
                  <div className="text-2xl font-bold text-white mt-1">$156</div>
                  <div className="text-xs text-amber-400 flex items-center gap-1 mt-1">
                    <ArrowUpRight className="h-3 w-3" />
                    rate lift
                  </div>
                </div>
              </div>

              <div className="mt-5 p-4 rounded-xl bg-gradient-to-r from-violet-600/20 to-blue-600/20 border border-violet-500/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Your team</p>
                    <p className="font-semibold text-white">Forecast Masters</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-slate-500">Rank</p>
                    <p className="text-xl font-bold text-gradient-primary">#4</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Season Progress card */}
            <motion.div
              className="glass-card rounded-2xl p-6 shadow-2xl shadow-blue-500/5 animate-float-slow"
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Season progress</p>
                  <h3 className="text-lg font-semibold text-white mt-1">Seven Weekly Rounds</h3>
                </div>
                <Trophy className="h-5 w-5 text-amber-400" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((round) => (
                  <div key={round} className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${round <= 3 ? 'bg-violet-500' : 'bg-white/10'}`} />
                    <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-violet-500 to-blue-500"
                        initial={{ width: 0 }}
                        animate={{ width: round <= 3 ? '100%' : round === 4 ? '45%' : '0%' }}
                        transition={{ duration: 1, delay: round * 0.15, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 w-14 text-right">Round {round}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <ChevronDown className="h-6 w-6 text-slate-600" />
      </motion.div>
    </section>
  )
}

/* ─────────────────────── SOCIAL PROOF STRIP ─────────────────────── */

export function SocialProofStrip() {
  const proofs = [
    { label: 'Universities worldwide', icon: Building2 },
    { label: 'Weekly ET deadlines', icon: Users },
    { label: '78 scored forecast errors', icon: BarChart3 },
    { label: 'DQ after 3 missed rounds', icon: CheckCircle2 },
  ]

  return (
    <section className="relative py-14 bg-canvas border-y border-white/5 overflow-hidden">
      <div className="absolute -left-32 top-1/2 -translate-y-1/2 w-[400px] h-[300px] rounded-full bg-violet-600/10 blur-[120px] orb-drift-2 pointer-events-none" />
      <div className="absolute inset-0 grain-overlay pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-6"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-50px' }}
          variants={staggerFast}
        >
          {proofs.map((item) => (
            <motion.div
              key={item.label}
              variants={fadeInUp}
              className="flex items-center gap-3 glass-card rounded-xl px-5 py-4"
            >
              <item.icon className="h-4 w-4 text-violet-400 flex-shrink-0" />
              <span className="text-sm font-medium text-slate-300">{item.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ─────────────────────── HOW IT WORKS ─────────────────────── */

export function HowItWorksSection() {
  const colorMap: Record<string, string> = {
    violet: 'from-violet-500 to-violet-600',
    blue: 'from-blue-500 to-blue-600',
    amber: 'from-amber-500 to-amber-600',
    emerald: 'from-emerald-500 to-emerald-600',
  }

  return (
    <section id="how-it-works" className="relative py-24 bg-canvas overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-600/8 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 -right-32 w-[400px] h-[350px] rounded-full bg-blue-500/10 blur-[120px] orb-drift-3 pointer-events-none" />
      <div className="absolute inset-0 grain-overlay pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold bg-white/5 border border-white/10 text-slate-400">
            Simple process
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-5 font-display">
            Four steps to the leaderboard
          </h2>
          <p className="text-slate-400 mt-4 max-w-xl mx-auto">
            Register, forecast, get scored, and climb the rankings. Every week.
          </p>
        </motion.div>

        <div className="relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-[52px] left-[12.5%] right-[12.5%] h-[2px] glow-line rounded-full" />

          <motion.div
            className="grid md:grid-cols-4 gap-8"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-80px' }}
            variants={staggerSlow}
          >
            {howItWorks.map((step) => (
              <motion.div key={step.step} variants={fadeInUp} className="text-center relative">
                <div className={`w-[104px] h-[104px] rounded-2xl bg-gradient-to-br ${colorMap[step.color]} flex items-center justify-center mx-auto shadow-lg relative z-10`}>
                  <step.icon className="h-10 w-10 text-white" />
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-canvas border-2 border-white/10 text-xs font-bold text-white flex items-center justify-center">
                    {step.step}
                  </span>
                </div>
                <h3 className="font-semibold text-white mt-6 text-lg">{step.title}</h3>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-[220px] mx-auto">{step.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────── LEADERBOARD ─────────────────────── */

export function LeaderboardSection() {
  return (
    <section id="leaderboard" className="relative py-24 bg-canvas-light overflow-hidden">
      <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-amber-500/8 blur-[120px] rounded-full pointer-events-none -translate-y-1/2" />
      <div className="absolute top-0 -left-32 w-[350px] h-[350px] rounded-full bg-violet-500/8 blur-[120px] orb-drift-1 pointer-events-none" />
      <div className="absolute inset-0 grain-overlay pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400">
            Live rankings
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-5 font-display">
            Know where you stand
          </h2>
          <p className="text-slate-400 mt-4">Rankings update after each round when actuals are released.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card rounded-2xl overflow-hidden shadow-2xl shadow-violet-500/5"
        >
          {/* Header bar */}
          <div className="bg-gradient-to-r from-violet-600/20 to-blue-600/20 border-b border-white/5 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-400" />
              <span className="font-semibold text-white">Leaderboard</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <span>Round 5 of 7</span>
              <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                72/78 scored
              </span>
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/5 text-xs font-medium text-slate-500 uppercase tracking-wider">
            <div className="col-span-1">Rank</div>
            <div className="col-span-4">Team</div>
            <div className="col-span-4">University</div>
            <div className="col-span-3 text-right">MAPE</div>
          </div>

          {/* Rows */}
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerFast}
          >
            {leaderboardData.map((row) => (
              <motion.div
                key={row.rank}
                variants={fadeInUp}
                className="grid grid-cols-12 gap-4 px-6 py-4 items-center border-b border-white/5 hover:bg-white/[0.02] transition-colors"
              >
                <div className="col-span-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    row.rank === 1 ? 'bg-amber-400/20 text-amber-400 shadow-lg shadow-amber-500/20' :
                    row.rank === 2 ? 'bg-slate-400/20 text-slate-300' :
                    row.rank === 3 ? 'bg-amber-600/20 text-amber-500' :
                    'bg-white/5 text-slate-500'
                  }`}>
                    {row.rank}
                  </div>
                </div>
                <div className="col-span-4 font-medium text-white">{row.team}</div>
                <div className="col-span-4 text-slate-400 text-sm">{row.university}</div>
                <div className="col-span-3 text-right">
                  <span className="text-emerald-400 font-semibold text-sm">{row.mape}</span>
                </div>
              </motion.div>
            ))}

            {/* Your team placeholder */}
            <motion.div
              variants={fadeInUp}
              className="grid grid-cols-12 gap-4 px-6 py-4 items-center border-2 border-dashed animate-pulse-border rounded-b-xl bg-violet-500/5"
            >
              <div className="col-span-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-violet-500/20 text-violet-400">
                  ?
                </div>
              </div>
              <div className="col-span-4 font-medium text-violet-300">Your team</div>
              <div className="col-span-4 text-violet-400/70 text-sm">Your university</div>
              <div className="col-span-3 text-right">
                <Link href="/register">
                  <Button size="sm" className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-xs shadow-lg shadow-violet-500/20">
                    Join to compete
                  </Button>
                </Link>
              </div>
            </motion.div>
          </motion.div>

          <div className="px-6 py-3 text-center text-xs text-slate-500 border-t border-white/5">
            Updated after each round. Coverage: 72/78 points (actual=0 excluded).
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ─────────────────────── MARKETS ─────────────────────── */

export function MarketsSection() {
  const glowMap: Record<string, string> = {
    violet: 'hover:shadow-violet-500/20 hover:border-violet-500/20',
    amber: 'hover:shadow-amber-500/20 hover:border-amber-500/20',
    emerald: 'hover:shadow-emerald-500/20 hover:border-emerald-500/20',
  }
  const barMap: Record<string, string> = {
    violet: 'from-violet-500 to-violet-400',
    amber: 'from-amber-500 to-amber-400',
    emerald: 'from-emerald-500 to-emerald-400',
  }
  const textMap: Record<string, string> = {
    violet: 'text-violet-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
  }
  const badgeMap: Record<string, string> = {
    violet: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  }

  return (
    <section id="markets" className="relative py-24 bg-canvas overflow-hidden">
      <div className="absolute bottom-0 left-0 w-[500px] h-[400px] bg-emerald-500/8 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-0 -right-32 w-[400px] h-[350px] rounded-full bg-amber-500/10 blur-[120px] orb-drift-2 pointer-events-none" />
      <div className="absolute inset-0 grain-overlay pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            Real markets
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-5 font-display">
            Three markets. One challenge.
          </h2>
          <p className="text-slate-400 mt-4 max-w-xl mx-auto">
            Different demand drivers, different volatility. Learn what moves each market.
          </p>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-3 gap-6"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-80px' }}
          variants={staggerFast}
        >
          {markets.map((market) => (
            <motion.div
              key={market.name}
              variants={scaleIn}
              whileHover={{ y: -6 }}
              className={`glass-card glass-card-hover rounded-2xl overflow-hidden transition-all duration-300 shadow-lg ${glowMap[market.color]}`}
            >
              <div className={`h-1.5 bg-gradient-to-r ${barMap[market.color]}`} />
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`font-semibold text-lg ${textMap[market.color]}`}>{market.name}</h3>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${badgeMap[market.color]}`}>
                    {market.signal}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-3">{market.country}</p>
                <p className="text-sm text-slate-400 leading-relaxed">{market.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ─────────────────────── FOR UNIVERSITIES ─────────────────────── */

export function ForUniversitiesSection() {
  return (
    <section id="universities" className="relative py-24 bg-canvas-light overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[400px] bg-blue-500/8 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 -left-32 w-[400px] h-[350px] rounded-full bg-violet-500/8 blur-[120px] orb-drift-1 pointer-events-none" />
      <div className="absolute inset-0 grain-overlay pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400">
            For universities
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-5 font-display">
            Built for teaching at scale
          </h2>
          <p className="text-slate-400 mt-4 max-w-xl mx-auto">
            Run forecasting competitions with professional structure so students focus on learning.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Feature grid */}
          <motion.div
            className="grid sm:grid-cols-2 gap-4"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-80px' }}
            variants={staggerFast}
          >
            {universityFeatures.map((feature) => (
              <motion.div
                key={feature.title}
                variants={fadeInUp}
                className="glass-card glass-card-hover rounded-xl p-5 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center mb-4">
                  <feature.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold text-white text-sm">{feature.title}</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Scoring + governance */}
          <motion.div
            className="space-y-5"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {/* Scoring formula */}
            <motion.div variants={slideFromRight} className="glass-card rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Scoring formula</h3>
                <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                  78 scored points
                </span>
              </div>
              <div className="space-y-2">
                {scoringFormula.map((line) => (
                  <div key={line} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <code className="text-slate-300 font-mono text-xs">{line}</code>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Governance */}
            <motion.div variants={slideFromRight} className="glass-card rounded-xl p-6">
              <h3 className="font-semibold text-white mb-4">Governance</h3>
              <div className="space-y-3">
                {governanceBadges.map((item) => (
                  <div key={item.label} className="flex items-center gap-3 text-sm text-slate-400">
                    <item.icon className="h-4 w-4 text-violet-400 flex-shrink-0" />
                    {item.label}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* CTA */}
            <motion.div variants={slideFromRight} className="glass-card rounded-xl p-6 bg-gradient-to-r from-violet-600/10 to-blue-600/10 border-violet-500/10">
              <h3 className="font-semibold text-white">Ready to onboard your program?</h3>
              <p className="text-sm text-slate-400 mt-2">
                Free trial weeks available. Paid participation required for official ranking.
              </p>
              <Link href="/request-demo" className="inline-block mt-4">
                <Button className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-sm shadow-lg shadow-violet-500/20">
                  Request a Demo
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────── FAQ ─────────────────────── */

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="font-medium text-white text-sm pr-4">{question}</span>
        {open ? <Minus className="h-4 w-4 text-slate-500 flex-shrink-0" /> : <Plus className="h-4 w-4 text-slate-500 flex-shrink-0" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5 text-sm text-slate-400 leading-relaxed">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function FaqSection() {
  return (
    <section className="relative py-24 bg-canvas overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-violet-600/8 blur-[120px] orb-drift-2 pointer-events-none" />
      <div className="absolute inset-0 grain-overlay pointer-events-none" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold bg-white/5 border border-white/10 text-slate-400">
            FAQ
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-5 font-display">
            Questions we hear most
          </h2>
          <p className="text-slate-400 mt-4">Clear answers before you commit.</p>
        </motion.div>

        <motion.div
          className="space-y-3"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-50px' }}
          variants={staggerFast}
        >
          {faqItems.map((item) => (
            <motion.div key={item.question} variants={fadeInUp}>
              <FaqItem question={item.question} answer={item.answer} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ─────────────────────── FINAL CTA ─────────────────────── */

export function FinalCtaSection({ audience }: { audience: AudienceType }) {
  const isProfessor = audience === 'professor'

  return (
    <section className="relative py-28 overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 via-canvas to-blue-900/40" />
      <div className="absolute inset-0 bg-canvas/60" />

      {/* Glow orbs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-violet-600/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-0 -left-32 w-[350px] h-[350px] rounded-full bg-blue-500/10 blur-[120px] orb-drift-3 pointer-events-none" />
      <div className="absolute bottom-0 -right-32 w-[350px] h-[300px] rounded-full bg-amber-500/10 blur-[120px] orb-drift-1 pointer-events-none" />
      <div className="absolute inset-0 grain-overlay pointer-events-none" />

      <div className="max-w-3xl mx-auto px-4 text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="space-y-8"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/20 flex items-center justify-center mx-auto shadow-2xl shadow-amber-500/10">
            <Trophy className="h-10 w-10 text-amber-400" />
          </div>

          <h2 className="text-3xl md:text-5xl font-bold text-white font-display leading-tight">
            Ready to build a{' '}
            <span className="text-gradient-gold">forecasting record</span>?
          </h2>

          <p className="text-lg text-slate-400 max-w-xl mx-auto">
            {isProfessor
              ? 'Give your cohort a governed competition with audit-ready scoring.'
              : 'Join the global leaderboard. Prove your accuracy across 7 rounds.'}
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="text-base px-10 py-6 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white shadow-xl shadow-violet-500/25 animate-pulse-glow">
                {isProfessor ? <Building2 className="h-5 w-5 mr-2" /> : <GraduationCap className="h-5 w-5 mr-2" />}
                {isProfessor ? 'Register University' : 'Create Account'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-3 text-sm text-slate-500">
            {['Teams of 1-5', '3 markets x 2 metrics', '7 weekly rounds', 'Free trial available'].map((item) => (
              <span key={item} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-violet-400" />
                {item}
              </span>
            ))}
          </div>

          <Link href="/login" className="text-sm text-slate-500 hover:text-slate-300 transition-colors inline-block">
            Already have an account? Sign in
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

/* ─────────────────────── FOOTER ─────────────────────── */

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 py-10 px-4 bg-canvas">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-white font-display">{brand.name}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a href="#" className="hover:text-slate-300 transition-colors">Privacy</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Terms</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Contact</a>
          </div>
          <p className="text-sm text-slate-600">
            {brand.year} {brand.tagline}
          </p>
        </div>
      </div>
    </footer>
  )
}

/* ─────────────────────── MAIN ASSEMBLY ─────────────────────── */

export function LandingPage() {
  const [audience, setAudience] = useState<AudienceType>('student')

  return (
    <>
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
    </>
  )
}
