'use client'

import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle,
  AlertTriangle,
  Trophy,
  Users,
  Clock,
  Target,
  Calculator,
  Send,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Mail,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function RulesPage() {
  const router = useRouter()
  const [acknowledged, setAcknowledged] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const redirectTimerRef = useRef<number | null>(null)

  useEffect(() => {
    fetchAcknowledgment()
  }, [])

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current)
      }
    }
  }, [])

  const fetchAcknowledgment = async () => {
    try {
      const res = await csrfFetch('/api/users/me')
      if (res.ok) {
        const data = await res.json()
        setAcknowledged(!!data.user.rulesAcknowledgedAt)
      }
    } catch (error) {
      clientLogger.error('Failed to fetch:', error)
      toast.error('Failed to load rules')
    }
  }

  const handleAcknowledge = async () => {
    setLoading(true)
    try {
      const res = await csrfFetch('/api/users/acknowledge-rules', { method: 'POST' })
      if (res.ok) {
        setAcknowledged(true)
        setShowSuccess(true)
        redirectTimerRef.current = window.setTimeout(() => {
          router.push('/dashboard')
          router.refresh()
        }, 1200)
      }
    } catch (error) {
      clientLogger.error('Failed to acknowledge:', error)
      toast.error('Failed to acknowledge rules')
    } finally {
      setLoading(false)
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const sectionIsOpen = (section: string) => expandedSection === section

  if (acknowledged === null) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 animate-pulse">
        <div className="mb-8 text-center space-y-2">
          <div className="mx-auto h-8 w-64 rounded bg-surface-secondary" />
          <div className="mx-auto h-4 w-80 rounded bg-surface-secondary" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 rounded-lg bg-surface-secondary" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {showSuccess && (
        <div className="fixed right-6 top-6 z-50 rounded-lg border border-success/20 bg-success-background px-4 py-3 text-sm text-success shadow-card">
          Acknowledged. Redirecting to your dashboard...
        </div>
      )}

      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-foreground">Guidelines + Help</h1>
        <p className="mt-2 text-text-secondary">RevME Forecaster Cup - everything you need to know</p>
      </div>

      {acknowledged === false && (
        <AlertBanner variant="warning" title="Action required">
          Please read and acknowledge the rules below to participate in the competition.
        </AlertBanner>
      )}

      <Card className="border-primary/20 bg-primary-soft/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Your First Steps
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-text-secondary">
          <ol className="list-inside list-decimal space-y-2">
            <li>Your supervisor will create your team and add you to it</li>
            <li>One team member is designated as the <strong>submitter</strong> — only they can submit forecasts</li>
            <li>Before each round deadline, the submitter enters predictions for all 3 markets</li>
            <li>After the round closes, admin scores submissions and publishes the leaderboard</li>
          </ol>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Competition Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-text-secondary">
            <p>The RevME Forecaster Cup is a hospitality revenue forecasting competition where teams predict hotel performance metrics.</p>
            <ul className="list-inside list-disc space-y-2">
              <li><strong>8 rounds</strong> of weekly forecasting</li>
              <li>Predict a <strong>2-week ahead</strong> horizon (Week+1 and Week+2)</li>
              <li>Two metrics: <strong>Occupancy</strong> and <strong>ADR ($)</strong></li>
              <li>Three markets: <strong>Nashville CBD, Dubai, Hamburg</strong></li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Team Structure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-text-secondary">
            <ul className="list-inside list-disc space-y-2">
              <li>Each team can have <strong>up to 5 students</strong></li>
              <li>Teams are created by <strong>supervisors only</strong></li>
              <li>Each team has <strong>1 designated submitter</strong></li>
              <li>Each supervisor can manage <strong>up to 10 teams</strong></li>
              <li>Students <strong>cannot create teams</strong> themselves</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Submissions + Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-text-secondary">
            <ul className="list-inside list-disc space-y-2">
              <li>Submit forecasts before the <strong>round deadline</strong></li>
              <li>Submissions are <strong>permanently locked</strong> after submit</li>
              <li>
                Submit <strong>12 values per round</strong>: one Occupancy and one ADR prediction
                {' '}per market (3 markets), for each of 2 upcoming weeks
                <div className="ml-6 mt-1 text-text-muted">
                  Enter numbers only — no $ or % symbols. Occupancy: 0–100. ADR: positive dollar amount (e.g. 189.50)
                </div>
              </li>
              <li>Late or missing submissions are <strong>not allowed</strong></li>
              <li>Deadlines are shown in <strong>your local time</strong> on the dashboard</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-warning/20 bg-warning-background/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Warnings + Disqualification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-text-secondary">
            <ul className="list-inside list-disc space-y-2">
              <li>Missed submission = <strong>1 warning</strong></li>
              <li>After <strong>3 warnings</strong>, team is <strong>disqualified</strong></li>
              <li>Disqualified teams cannot submit forecasts</li>
              <li>Warnings cannot be removed once issued</li>
            </ul>
            <p className="font-medium text-error">Disqualification is permanent for the season.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-accent" />
            Scoring + Leaderboards
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-text-secondary">
          <p>Scoring is based on <strong>Mean Absolute Percentage Error (MAPE)</strong>. Lower is better.</p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-info/20 bg-info-background/55 p-4">
              <h4 className="font-semibold text-info">Occupancy MAPE</h4>
              <p className="mt-1 text-xs text-text-secondary">|Predicted - Actual| / Actual x 100%</p>
            </div>
            <div className="rounded-lg border border-success/20 bg-success-background/55 p-4">
              <h4 className="font-semibold text-success">ADR MAPE</h4>
              <p className="mt-1 text-xs text-text-secondary">|Predicted - Actual| / Actual x 100%</p>
            </div>
            <div className="rounded-lg border border-accent/20 bg-accent-soft/60 p-4">
              <h4 className="font-semibold text-accent">Final Score</h4>
              <p className="mt-1 text-xs text-text-secondary">Average of Occupancy and ADR MAPE</p>
            </div>
          </div>
          <p>
            Leaderboards show rankings for <strong>Occupancy</strong>, <strong>ADR</strong>, and <strong>Combined</strong> scores.
            Teams and universities are ranked separately.
          </p>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary-soft/35">
        <CardHeader className="cursor-pointer" onClick={() => toggleSection('scoring')}>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              How Scoring Works
            </span>
            {sectionIsOpen('scoring') ? <ChevronUp className="h-5 w-5 text-primary" /> : <ChevronDown className="h-5 w-5 text-primary" />}
          </CardTitle>
        </CardHeader>
        {sectionIsOpen('scoring') && (
          <CardContent className="space-y-4 text-sm text-text-secondary">
            <div className="rounded-lg border border-border bg-card p-4">
              <h4 className="mb-2 font-semibold text-foreground">Mean Absolute Percentage Error (MAPE)</h4>
              <p className="mb-3">Your score is based on the percentage error between your predictions and actual values. Lower is better.</p>
              <div className="rounded-lg border border-border bg-surface-secondary p-3 text-center font-mono text-sm">
                MAPE = Average of (|Predicted - Actual| / Actual) x 100%
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4">
                <h4 className="mb-2 font-semibold text-primary">Occupancy Scoring</h4>
                <p>If you predict 75 and actual is 78, your error is |75-78|/78 = 3.85%.</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <h4 className="mb-2 font-semibold text-success">ADR Scoring</h4>
                <p>If you predict $150 and actual is $155, your error is |150-155|/155 = 3.23%.</p>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <h4 className="mb-2 font-semibold text-foreground">Round vs Season Scores</h4>
              <ul className="space-y-1">
                <li>Round score: MAPE across all predictions in that round</li>
                <li>Season score: MAPE across all predictions in the entire season</li>
                <li>Leaderboards show separate rankings for Occupancy and ADR</li>
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="border-success/20 bg-success-background/35">
        <CardHeader className="cursor-pointer" onClick={() => toggleSection('submit')}>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Send className="h-5 w-5 text-success" />
              How to Submit Forecasts
            </span>
            {sectionIsOpen('submit') ? <ChevronUp className="h-5 w-5 text-success" /> : <ChevronDown className="h-5 w-5 text-success" />}
          </CardTitle>
        </CardHeader>
        {sectionIsOpen('submit') && (
          <CardContent className="space-y-4 text-sm text-text-secondary">
            <div className="rounded-lg border border-info/20 bg-info-background/55 p-4 text-sm">
              <p className="mb-1 font-medium text-foreground">Who submits?</p>
              <p>Only the <strong>designated submitter</strong> on your team can submit. If you are not the submitter, your teammate will submit on behalf of the team. You can view your team&apos;s submitted forecasts under <strong>My Scores</strong> after submission.</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <h4 className="mb-2 font-semibold text-foreground">Step-by-Step Guide</h4>
              <ol className="list-inside list-decimal space-y-2">
                <li><strong>Go to Submit Forecast</strong> from your dashboard</li>
                <li><strong>Select the current round</strong> if multiple are available</li>
                <li>
                  <strong>Enter predictions</strong> for each market and metric:
                  <ul className="ml-6 mt-1 list-disc">
                    <li>Occupancy (value, e.g. 75.5)</li>
                    <li>ADR (as dollar amount, e.g. 189.50)</li>
                  </ul>
                </li>
                <li><strong>Review all values</strong> carefully before submitting</li>
                <li><strong>Click Submit</strong> to lock in your forecast</li>
              </ol>
            </div>
            <AlertBanner variant="warning" title="Important notes">
              <ul className="list-inside list-disc space-y-1">
                <li>Only the designated submitter can submit forecasts</li>
                <li>Submissions are locked immediately after submitting</li>
                <li>You cannot edit or delete a submitted forecast</li>
                <li>Submit before the deadline shown on your dashboard</li>
              </ul>
            </AlertBanner>
          </CardContent>
        )}
      </Card>

      <Card className="border-accent/20 bg-accent-soft/35">
        <CardHeader className="cursor-pointer" onClick={() => toggleSection('help')}>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-accent" />
              Contact Admin / Get Help
            </span>
            {sectionIsOpen('help') ? <ChevronUp className="h-5 w-5 text-accent" /> : <ChevronDown className="h-5 w-5 text-accent" />}
          </CardTitle>
        </CardHeader>
        {sectionIsOpen('help') && (
          <CardContent className="space-y-4 text-sm text-text-secondary">
            <div className="rounded-lg border border-border bg-card p-4">
              <h4 className="mb-3 font-semibold text-foreground">Need assistance?</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-5 w-5 text-accent" />
                  <div>
                    <p className="font-medium text-foreground">Contact Your Supervisor</p>
                    <p>For team-related questions, submission issues, or general guidance.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <HelpCircle className="mt-0.5 h-5 w-5 text-accent" />
                  <div>
                    <p className="font-medium text-foreground">Submit a Support Ticket</p>
                    <p>For technical issues, login problems, or competition questions.</p>
                    <Link href="/support" className="mt-1 inline-flex items-center font-medium text-primary hover:text-primary-hover">
                      Go to Support Center
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-accent/20 bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="medal">Common Issues</Badge>
              </div>
              <ul className="space-y-1 text-text-secondary">
                <li>Cannot submit? Check if you are the designated submitter.</li>
                <li>Missing team? Contact your supervisor to be added.</li>
                <li>Deadline passed? Contact admin for assistance.</li>
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="border-primary/20">
        <CardContent className="py-6">
          <div className="text-center">
            {acknowledged ? (
              <div className="flex items-center justify-center gap-3 text-success">
                <CheckCircle className="h-6 w-6" />
                <span className="font-medium">You have acknowledged the competition guidelines.</span>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-text-secondary">
                  By clicking below, you confirm that you have read and understand the competition guidelines.
                </p>
                <Button onClick={handleAcknowledge} disabled={loading} size="lg">
                  {loading ? 'Acknowledging...' : 'I Acknowledge the Guidelines'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
