'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { csrfFetch } from '@/lib/csrf'
import { AuthShell } from '@/components/auth/auth-shell'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const dynamic = 'force-dynamic'

function VerifyEmailPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    const nextEmail = searchParams.get('email')
    if (nextEmail) {
      setEmail(nextEmail)
    }
  }, [searchParams])

  const notice = useMemo(() => {
    if (searchParams.get('reason') === 'signin') {
      return {
        variant: 'warning' as const,
        message: 'Verify your email before signing in.',
      }
    }

    if (searchParams.get('sent') === '0') {
      return {
        variant: 'warning' as const,
        message: 'We could not send the verification email. Request a new code below.',
      }
    }

    return {
      variant: 'info' as const,
      message: 'We sent a verification code to your email. Enter the 6-digit code to activate your account.',
    }
  }, [searchParams])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!email.trim()) {
      setError('Enter your email address.')
      return
    }

    if (!code.trim()) {
      setError('Enter the verification code.')
      return
    }

    setVerifying(true)

    try {
      const res = await csrfFetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Email verification failed.')
        return
      }

      setSuccess(data.message || 'Your email has been verified.')
      router.push(`/login?verified=1&email=${encodeURIComponent(email.trim())}`)
    } catch {
      setError('We could not verify your email right now. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setSuccess('')

    if (!email.trim()) {
      setError('Enter your email address.')
      return
    }

    setResending(true)

    try {
      const res = await csrfFetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'We could not send a new verification code right now.')
        return
      }

      setSuccess(data.message || 'A new verification code has been sent.')
    } catch {
      setError('We could not send a new verification code right now. Please try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthShell
      title="Verify your email"
      description="We sent a verification code to your email. Enter the 6-digit code to activate your account."
    >
      <form onSubmit={handleVerify} className="space-y-5">
        <AlertBanner variant={notice.variant} className="shadow-none">
          {notice.message}
        </AlertBanner>

        {success ? (
          <AlertBanner variant="success" className="shadow-none">
            {success}
          </AlertBanner>
        ) : null}

        {error ? (
          <AlertBanner variant="error" className="shadow-none">
            {error}
          </AlertBanner>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-text-secondary">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@university.edu"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="code" className="text-sm font-medium text-text-secondary">
            Verification code
          </Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Enter the 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            required
          />
        </div>

        <div className="space-y-3">
          <Button type="submit" className="w-full" disabled={verifying}>
            {verifying ? 'Verifying...' : 'Verify Email'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? 'Sending...' : 'Resend Code'}
          </Button>
        </div>

        <p className="text-center text-sm text-text-secondary">
          Already verified?{' '}
          <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthShell
          title="Verify your email"
          description="We sent a verification code to your email. Enter the 6-digit code to activate your account."
        >
          <div className="space-y-4">
            <div className="h-11 rounded-md border border-border bg-card" />
            <div className="h-11 rounded-md border border-border bg-card" />
            <div className="h-11 rounded-md bg-primary/15" />
          </div>
        </AuthShell>
      }
    >
      <VerifyEmailPageContent />
    </Suspense>
  )
}
