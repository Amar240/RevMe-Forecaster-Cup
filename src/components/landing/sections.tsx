"use client"

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  BarChart3,
  Trophy,
  ChevronDown,
  Building2,
  Users,
  Target,
  GraduationCap,
  ArrowUpRight,
  Sparkles,
  Shield,
  CheckCircle2,
  TrendingUp,
  Lock,
  Mail,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CountUp } from '@/components/landing/CountUp'
import { fadeInUp, staggerContainer } from '@/components/landing/animations'
import {
  heroStats,
  trustSignals,
  whyStudentsJoin,
  leaderboardData,
  professorFeatures,
  howItWorks,
  markets,
  heroBadge,
  brand,
  securityHighlights,
  studentRoi,
  universityBenefits,
  seasonTimeline,
  faqItems,
} from '@/data/landing'

export function SiteHeader() {
  return (
    <header className="relative border-b border-zinc-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-zinc-900 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-xl font-semibold text-zinc-900 font-display">{brand.name}</div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Forecaster Cup</div>
            </div>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#why-join" className="text-zinc-600 hover:text-zinc-900 transition-colors text-sm font-medium">Why Join</a>
            <a href="#leaderboard" className="text-zinc-600 hover:text-zinc-900 transition-colors text-sm font-medium">Leaderboard</a>
            <a href="#markets" className="text-zinc-600 hover:text-zinc-900 transition-colors text-sm font-medium">Markets</a>
            <a href="#professors" className="text-zinc-600 hover:text-zinc-900 transition-colors text-sm font-medium">For Universities</a>
          </nav>
          <div className="flex items-center space-x-3">
            <Link href="/login">
              <Button variant="ghost" className="text-zinc-600 hover:text-zinc-900 font-medium">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium">Join Now</Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100 via-white to-amber-50" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[size:40px_40px]" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 relative">
        <motion.div
          className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          <motion.div variants={fadeInUp} className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-zinc-900 text-white">
              <heroBadge.icon className="h-3.5 w-3.5 text-amber-300" />
              {heroBadge.text}
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-zinc-900 leading-tight tracking-tight font-display">
              International forecasting competition.
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-amber-500 to-emerald-500">
                $1,000 prize for the top team.
              </span>
            </h1>

            <p className="text-lg text-zinc-600 max-w-xl">
              Built for students and universities to benchmark forecasting skill in real markets.
              Verified teams, secure submissions, and audit ready scoring keep competition data protected.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/register">
                <Button size="lg" className="text-base px-8 py-6 bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm">
                  <GraduationCap className="h-5 w-5 mr-2" />
                  Join as Student
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" size="lg" className="text-base px-6 py-6 border-zinc-300 text-zinc-700 hover:bg-zinc-100">
                  <Building2 className="h-5 w-5 mr-2" />
                  Register Your University
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap gap-8">
              {heroStats.map((stat) => (
                <div key={stat.label} className="min-w-[140px]">
                  <CountUp value={stat.value} />
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              {trustSignals.map((signal) => (
                <div key={signal.label} className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold bg-white/80 border border-zinc-200 text-zinc-700">
                  <signal.icon className="h-3.5 w-3.5 text-emerald-600" />
                  {signal.label}
                </div>
              ))}
            </div>

            <a href="#professors" className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-700 transition-colors">
              <Building2 className="h-4 w-4 mr-1.5" />
              For Professors and Universities
              <ChevronDown className="h-4 w-4 ml-1" />
            </a>
          </motion.div>

          <motion.div variants={fadeInUp} className="space-y-6">
            <Card className="border-zinc-200 shadow-xl bg-white/90 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Live round</p>
                    <h3 className="text-lg font-semibold text-zinc-900">Round 3 forecast window</h3>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">Open</span>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border border-zinc-200 bg-zinc-50">
                    <p className="text-xs text-zinc-500">Occupancy target</p>
                    <div className="text-2xl font-bold text-zinc-900">74.2</div>
                    <div className="text-xs text-emerald-600 flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      steady demand
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border border-zinc-200 bg-zinc-50">
                    <p className="text-xs text-zinc-500">ADR target</p>
                    <div className="text-2xl font-bold text-zinc-900">$156</div>
                    <div className="text-xs text-amber-600 flex items-center gap-1">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      rate lift
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-lg bg-zinc-900 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Your team</p>
                      <p className="font-semibold">Forecast Masters</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-400">Current rank</p>
                      <p className="text-xl font-bold">#4</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-200 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Season cadence</p>
                    <h3 className="text-lg font-semibold text-zinc-900">Seven weekly rounds</h3>
                  </div>
                  <Sparkles className="h-5 w-5 text-amber-500" />
                </div>
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((round) => (
                    <div key={round} className="flex items-center gap-3">
                      <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                      <div className="flex-1 h-2 rounded-full bg-zinc-200 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400" style={{ width: `${round * 22}%` }} />
                      </div>
                      <span className="text-xs text-zinc-500">Round {round}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

export function WhyJoinSection() {
  return (
    <section id="why-join" className="py-24 px-4 bg-zinc-900 text-white">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/80">For Students</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-4 font-display">
              A competition that feels like the real job.
            </h2>
            <p className="text-white/70 mt-4">
              Weekly rounds mirror how forecasting teams actually operate. You build a record of
              accuracy, learn to explain variance, and collaborate with a supervisor.
            </p>
            <div className="mt-6 flex items-center gap-3 text-sm text-white/70">
              <Shield className="h-4 w-4 text-emerald-300" />
              Scoring and submissions are audit tracked.
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {whyStudentsJoin.map((item) => (
              <div key={item.title} className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center mb-3">
                  <item.icon className="h-5 w-5 text-amber-300" />
                </div>
                <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/70 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export function StudentRoiSection() {
  return (
    <section className="py-24 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">Student ROI</span>
          <h2 className="text-3xl font-bold text-zinc-900 mt-4 font-display">Why it is worth it</h2>
          <p className="text-zinc-600 mt-3">Outcomes you can show, not just claims.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {studentRoi.map((item) => (
            <Card key={item.title} className="border-zinc-200 bg-white">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center mb-4">
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-zinc-900">{item.title}</h3>
                <p className="text-sm text-zinc-600 mt-2">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

export function UniversityValueSection() {
  return (
    <section className="py-24 px-4 bg-zinc-50">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">University value</span>
          <h2 className="text-3xl font-bold text-zinc-900 mt-4 font-display">Why universities join</h2>
          <p className="text-zinc-600 mt-3">A structured competition with measurable outcomes.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {universityBenefits.map((item) => (
            <Card key={item.title} className="border-zinc-200 bg-white">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center mb-4">
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-zinc-900">{item.title}</h3>
                <p className="text-sm text-zinc-600 mt-2">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

export function TimelineSection() {
  return (
    <section className="py-24 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700">Season timeline</span>
          <h2 className="text-3xl font-bold text-zinc-900 mt-4 font-display">Seven round cadence</h2>
          <p className="text-zinc-600 mt-3">Each round runs for one week with locked deadlines.</p>
        </motion.div>

        <div className="grid md:grid-cols-7 gap-4">
          {seasonTimeline.map((item, index) => (
            <div key={item.label} className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-center">
              <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center mx-auto mb-3">
                <item.icon className="h-5 w-5 text-white" />
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Round {index + 1}</div>
              <div className="font-semibold text-zinc-900 mt-2 text-sm">{item.label}</div>
              <div className="text-xs text-zinc-500 mt-1">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function HowItWorksSection() {
  return (
    <section className="py-24 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700">Simple process</span>
          <h2 className="text-3xl font-bold text-zinc-900 mt-4 font-display">How the season runs</h2>
          <p className="text-zinc-600 mt-3">Four steps, seven rounds, consistent results.</p>
        </motion.div>

        <div className="grid md:grid-cols-4 gap-8">
          {howItWorks.map((step, index) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center">
                  <step.icon className="h-5 w-5 text-white" />
                </div>
                <div className="text-sm font-semibold text-zinc-500">Step {step.step}</div>
              </div>
              <h3 className="font-semibold text-zinc-900 mt-4">{step.title}</h3>
              <p className="text-sm text-zinc-600 mt-2">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function LeaderboardSection() {
  return (
    <section id="leaderboard" className="py-24 px-4 bg-zinc-50">
      <div className="max-w-4xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Live rankings</span>
          <h2 className="text-3xl font-bold text-zinc-900 mt-4 font-display">Know where you stand</h2>
          <p className="text-zinc-600 mt-3">Rankings update after each round when actuals are released.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-lg"
        >
          <div className="bg-zinc-900 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-400" />
              <span className="font-semibold">Leaderboard snapshot</span>
            </div>
            <span className="text-sm text-zinc-400">Round 5 of 7</span>
          </div>

          <div className="divide-y divide-zinc-100">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-zinc-50 text-xs font-medium text-zinc-500 uppercase tracking-wider">
              <div className="col-span-2">Rank</div>
              <div className="col-span-5">Team</div>
              <div className="col-span-5">University</div>
            </div>

            {leaderboardData.map((row, index) => (
              <div
                key={row.rank}
                className={`grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors ${
                  index === 0 ? 'bg-amber-50/50' : 'hover:bg-zinc-50'
                }`}
              >
                <div className="col-span-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    row.rank === 1 ? 'bg-amber-400 text-white' :
                    row.rank === 2 ? 'bg-zinc-300 text-zinc-700' :
                    row.rank === 3 ? 'bg-amber-600 text-white' :
                    'bg-zinc-100 text-zinc-600'
                  }`}>
                    {row.rank}
                  </div>
                </div>
                <div className="col-span-5 font-medium text-zinc-900">{row.team}</div>
                <div className="col-span-5 text-zinc-600 text-sm">{row.university}</div>
              </div>
            ))}

            <div className="grid grid-cols-12 gap-4 px-6 py-4 items-center bg-blue-50 border-2 border-blue-200 border-dashed">
              <div className="col-span-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-blue-500 text-white">
                  ?
                </div>
              </div>
              <div className="col-span-5 font-medium text-blue-700">Your team</div>
              <div className="col-span-5 text-blue-600 text-sm flex items-center justify-between">
                <span>Your university</span>
                <Link href="/register">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">Join to compete</Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="px-6 py-3 bg-zinc-50 text-center text-xs text-zinc-500">
            Updated after each round scoring.
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export function MarketsSection() {
  return (
    <section id="markets" className="py-24 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Real markets</span>
            <h2 className="text-3xl font-bold text-zinc-900 mt-4 font-display">
              Three markets. One consistent challenge.
            </h2>
            <p className="text-zinc-600 mt-3">
              Forecast in markets with different demand drivers. Learn how volatility,
              seasonality, and pricing behavior change your decision making.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 p-6 bg-zinc-50">
            <div className="text-sm text-zinc-500 uppercase tracking-[0.2em]">Market signals</div>
            <div className="mt-4 space-y-3">
              {markets.map((market) => (
                <div key={market.name} className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-zinc-900">{market.name}</div>
                    <div className="text-xs text-zinc-500">{market.country}</div>
                  </div>
                  <div className="text-xs font-semibold text-zinc-700 bg-white px-2.5 py-1 rounded-full border border-zinc-200">
                    {market.signal}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {markets.map((market, index) => (
            <motion.div
              key={market.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-all bg-white">
                <div className={`h-2 ${
                  market.color === 'blue' ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
                  market.color === 'amber' ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                  'bg-gradient-to-r from-emerald-400 to-emerald-600'
                }`} />
                <CardContent className="p-6">
                  <h3 className="font-semibold text-zinc-900">{market.name}</h3>
                  <p className="text-sm text-zinc-500">{market.country}</p>
                  <p className="text-sm text-zinc-600 mt-3 leading-relaxed">{market.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function SecuritySection() {
  return (
    <section id="security" className="py-24 px-4 bg-zinc-900 text-white">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/80">Protected competition</span>
          <h2 className="text-3xl font-bold mt-4 font-display">Secure by design</h2>
          <p className="text-white/70 mt-3 max-w-2xl mx-auto">
            Competition data is protected with role based access, submission locks, and audit trails.
            Organizers can demonstrate integrity at every step.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {securityHighlights.map((item) => (
            <div key={item.title} className="border border-white/10 rounded-xl p-6 bg-white/5">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center mb-4">
                <item.icon className="h-5 w-5 text-amber-300" />
              </div>
              <h3 className="font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-sm text-white/70">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FaqSection() {
  return (
    <section className="py-24 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700">FAQ</span>
          <h2 className="text-3xl font-bold text-zinc-900 mt-4 font-display">Questions we hear most</h2>
          <p className="text-zinc-600 mt-3">Clear answers before you commit.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {faqItems.map((item) => (
            <Card key={item.question} className="border-zinc-200 bg-white">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900">{item.question}</h3>
                    <p className="text-sm text-zinc-600 mt-2">{item.answer}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

export function CommunitySection() {
  return (
    <section className="py-24 px-4 bg-zinc-50">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700">Global community</span>
          <h2 className="text-3xl font-bold text-zinc-900 mt-4 font-display">Universities worldwide</h2>
          <p className="text-zinc-600 mt-3">Join a growing network of hospitality programs using the same platform.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-zinc-200 bg-white">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-zinc-900">Multi university ready</h3>
              <p className="text-sm text-zinc-600 mt-2">Designed for cross institutional participation and collaboration.</p>
            </CardContent>
          </Card>
          <Card className="border-zinc-200 bg-white">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-zinc-900">Built to scale</h3>
              <p className="text-sm text-zinc-600 mt-2">Platform capacity for large cohorts and growing programs.</p>
            </CardContent>
          </Card>
          <Card className="border-zinc-200 bg-white">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <Target className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-zinc-900">Industry aligned</h3>
              <p className="text-sm text-zinc-600 mt-2">MAPE based scoring mirrors real revenue management metrics.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

export function ProfessorsSection() {
  return (
    <section id="professors" className="py-24 px-4 bg-white border-y border-zinc-200">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-zinc-500 font-medium text-sm uppercase tracking-wider">For universities and organizers</span>
          <h2 className="text-3xl font-bold text-zinc-900 mt-4 font-display">Built for teaching and scale</h2>
          <p className="text-zinc-600 mt-3 max-w-xl mx-auto">
            Run forecasting competitions with professional structure so students focus on learning.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {professorFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="h-full border-zinc-200 bg-zinc-50/50 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-zinc-900 mb-2 text-lg">{feature.title}</h3>
                  <p className="text-zinc-600 text-sm leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-10 bg-zinc-100 rounded-xl border border-zinc-200 p-6"
        >
          <div className="grid md:grid-cols-[1fr_1fr] gap-6 items-center">
            <div>
              <h3 className="text-lg font-semibold text-zinc-900">Transparent scoring</h3>
              <p className="text-zinc-500 text-sm mt-2">Every calculation is logged and auditable.</p>
              <div className="mt-4 space-y-2 text-sm text-zinc-700">
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />APE = abs(predicted - actual) / actual</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />MAPE = average of all APE values</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />Final = (Occupancy MAPE + ADR MAPE) / 2</div>
              </div>
            </div>
            <div className="rounded-lg bg-white border border-zinc-200 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Governance</div>
              <div className="mt-4 space-y-3 text-sm text-zinc-700">
                <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-zinc-700" />Submissions locked after deadline</div>
                <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-zinc-700" />Audit log for every admin action</div>
                <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-zinc-700" />Role based access controls</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export function FinalCtaSection() {
  return (
    <section className="py-24 px-4 bg-zinc-900 text-white">
      <div className="max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Trophy className="h-10 w-10 text-amber-300" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 font-display">Ready to build a forecasting record?</h2>
          <p className="text-white/70 mb-8 text-lg">
            Compete for the $1,000 first place prize and join a global forecasting leaderboard.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-4">
            <Link href="/register">
              <Button size="lg" className="text-base px-8 py-6 bg-white hover:bg-zinc-100 text-zinc-900 shadow-xl">
                <GraduationCap className="h-5 w-5 mr-2" />
                Join as Student
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="outline" size="lg" className="text-base px-8 py-6 border-white/30 text-white hover:bg-white/10">
                <Building2 className="h-5 w-5 mr-2" />
                Register Your University
              </Button>
            </Link>
          </div>

          <p className="text-sm text-white/60 mb-4">
            Secure roles, verified teams, and reliable scoring built in.
          </p>

          <Link href="/login" className="text-sm text-white/70 hover:text-white transition-colors">
            Already have an account? Sign in
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 py-10 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-zinc-900 font-display">{brand.name}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <a href="#" className="hover:text-zinc-700 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-700 transition-colors">Terms</a>
            <a href="#" className="hover:text-zinc-700 transition-colors">Contact</a>
          </div>
          <p className="text-sm text-zinc-500">
            {brand.year} {brand.tagline}
          </p>
        </div>
      </div>
    </footer>
  )
}
