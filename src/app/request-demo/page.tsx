'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  Mail,
  Shield,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { csrfFetch } from '@/lib/csrf'

export const dynamic = 'force-dynamic'

export default function RequestDemoPage() {
  const [form, setForm] = useState({
    name: '',
    organization: '',
    email: '',
    message: '',
    companyWebsite: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onChange = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await csrfFetch('/api/request-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message || 'Unable to submit your request right now.')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Unable to submit your request right now.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-x-0 top-0 h-[26rem] bg-[radial-gradient(circle_at_top_left,rgba(232,240,250,0.92),rgba(247,249,252,0)_58%)]" />
      <div className="absolute left-0 top-20 h-72 w-72 rounded-full bg-primary-soft blur-3xl" />
      <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-accent-soft blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <div className="hidden items-center gap-3 sm:flex">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button>Register</Button>
            </Link>
          </div>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-card">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display text-2xl font-semibold text-foreground">RevME</p>
                <p className="text-xs uppercase tracking-[0.28em] text-text-muted">Forecaster Cup</p>
              </div>
            </div>

            <div className="space-y-4">
              <Badge variant="info" className="w-fit gap-2 px-3 py-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Request a program walkthrough
              </Badge>
              <h1 className="font-display text-4xl font-semibold text-foreground sm:text-5xl">
                See how RevME fits a real forecasting cohort.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-text-secondary">
                Share your program details and we&apos;ll walk you through competition setup, governance, scoring, and the student experience.
              </p>
            </div>

            <div className="grid gap-4">
              <Card className="border-border">
                <CardContent className="flex items-start gap-3 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Tailored to your cohort</p>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">
                      We can walk through team setup, supervisor workflows, and what a season looks like for your students.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="flex items-start gap-3 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Governance and scoring</p>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">
                      We&apos;ll show how submissions, actuals, leaderboard releases, and auditability are handled in a structured way.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card variant="subtle" className="border-border">
                <CardHeader>
                  <CardTitle className="text-base">Prefer email?</CardTitle>
                  <CardDescription>Reach out directly and we can coordinate the right time.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link
                    href="mailto:hello@revme.com?subject=RevME%20Forecaster%20Cup%20Demo"
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
                  >
                    <Mail className="h-4 w-4" />
                    hello@revme.com
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="border-border">
            <CardHeader className="border-b border-border bg-surface-secondary">
              <CardTitle className="font-display text-2xl">Request a demo</CardTitle>
              <CardDescription>
                Tell us a little about your institution and what you want to evaluate.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    required
                    value={form.name}
                    onChange={onChange('name')}
                    placeholder="Your full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organization">University / Organization</Label>
                  <Input
                    id="organization"
                    value={form.organization}
                    onChange={onChange('organization')}
                    placeholder="University name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={onChange('email')}
                    placeholder="you@university.edu"
                  />
                </div>

                <div className="hidden">
                  <Label htmlFor="companyWebsite">Company website</Label>
                  <Input
                    id="companyWebsite"
                    value={form.companyWebsite}
                    onChange={onChange('companyWebsite')}
                    placeholder="Leave blank"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">What do you want to achieve?</Label>
                  <Textarea
                    id="message"
                    rows={5}
                    value={form.message}
                    onChange={onChange('message')}
                    placeholder="Tell us about your cohort size, program goals, timeline, or any questions you want us to address."
                  />
                </div>

                <Button className="w-full" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit request'}
                </Button>

                {submitted && (
                  <div className="flex items-start gap-3 rounded-xl border border-border bg-success-background px-4 py-3 text-sm text-success">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>Request submitted. We&apos;ll reach out soon.</span>
                  </div>
                )}

                {error && (
                  <div className="rounded-xl border border-border bg-error-background px-4 py-3 text-sm text-error">
                    {error}
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
