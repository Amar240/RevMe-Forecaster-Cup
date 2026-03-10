'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Building2, Mail, Users, CheckCircle2, BarChart3, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    <div className="min-h-screen bg-canvas text-white relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute -top-32 -left-32 w-[400px] h-[400px] rounded-full bg-violet-600/15 blur-[120px] orb-drift-1 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[350px] h-[350px] rounded-full bg-blue-500/10 blur-[100px] orb-drift-2 pointer-events-none" />
      <div className="absolute inset-0 grain-overlay pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative">
        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-10">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/20">
            <Building2 className="h-3.5 w-3.5 text-amber-400" />
            Request a demo
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mt-5 font-display text-white">
            See the RevME Forecaster Cup{' '}
            <span className="text-gradient-primary">in action</span>
          </h1>
          <p className="text-slate-400 mt-3">
            Submit this form and we&apos;ll reach out with a walkthrough tailored to your program.
          </p>
        </div>

        <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-6 items-start">
          {/* Form card */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-300 text-sm">Name</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={onChange('name')}
                  placeholder="Your full name"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:ring-violet-500/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organization" className="text-slate-300 text-sm">University / Organization</Label>
                <Input
                  id="organization"
                  value={form.organization}
                  onChange={onChange('organization')}
                  placeholder="University name"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:ring-violet-500/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300 text-sm">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={onChange('email')}
                  placeholder="you@university.edu"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:ring-violet-500/20"
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
                <Label htmlFor="message" className="text-slate-300 text-sm">What do you want to achieve?</Label>
                <Textarea
                  id="message"
                  rows={4}
                  value={form.message}
                  onChange={onChange('message')}
                  placeholder="Tell us about your cohort size, timeline, and goals."
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:ring-violet-500/20"
                />
              </div>
              <Button
                className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white shadow-lg shadow-violet-500/20 border-0"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit request'}
              </Button>

              {submitted && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Request submitted. We&apos;ll reach out soon.
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                  {error}
                </div>
              )}
            </form>
          </div>

          {/* Side cards */}
          <div className="space-y-4">
            <div className="glass-card rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Users className="h-4 w-4 text-emerald-400" />
                What you&apos;ll see
              </div>
              <ul className="text-sm text-slate-400 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                  Competition setup and governance controls
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                  Scoring transparency and audit logs
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                  Student workflows and submission UX
                </li>
              </ul>
            </div>

            <div className="glass-card rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Mail className="h-4 w-4 text-violet-400" />
                Prefer email?
              </div>
              <p className="text-sm text-slate-400">
                You can also reach us directly and we&apos;ll schedule a walkthrough.
              </p>
              <Link href="mailto:hello@revme.com?subject=RevME%20Forecaster%20Cup%20Demo" className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
                hello@revme.com
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
