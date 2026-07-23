'use client'

import { csrfFetch } from '@/lib/csrf'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { AlertBanner } from '@/components/ui/alert-banner'
import { AuthShell } from '@/components/auth/auth-shell'
import { GoogleSignIn } from '@/components/auth/google-sign-in'

export const dynamic = 'force-dynamic'

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setSuccess(searchParams.get('verified') === '1' ? 'Your email has been verified.' : '')
    const oauthError = searchParams.get('error')
    if (oauthError === 'oauth_state') setError('Google sign-in expired or could not be verified. Please try again.')
    if (oauthError === 'oauth_verify') setError('Google could not verify your sign-in. Please try again.')
    if (oauthError === 'oauth_unverified_email') setError('Google has not verified that email. Sign in with your password instead.')
  }, [searchParams])

  useEffect(() => {
    const nextEmail = searchParams.get('email')
    if (!nextEmail) return

    setEmail((currentEmail) => currentEmail || nextEmail)
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const res = await csrfFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          const nextEmail = encodeURIComponent(data.details?.email || email)
          router.push(`/verify-email?email=${nextEmail}&reason=signin`)
          return
        }
        setError(data.message || 'Login failed')
        return
      }

      window.location.href = '/dashboard'
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Welcome back" description="Sign in to continue to your dashboard.">
        <form onSubmit={handleSubmit} className="space-y-5">
          <GoogleSignIn />
          {success && (
            <AlertBanner variant="success" className="shadow-none">
              {success}
            </AlertBanner>
          )}
          {error && (
            <AlertBanner variant="error" className="shadow-none">
              {error}
            </AlertBanner>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-text-secondary">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium text-text-secondary">Password</Label>
              <Link href="/forgot-password" className="text-xs font-medium text-primary hover:text-primary-hover">
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
          <p className="text-center text-sm text-text-secondary">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-medium text-primary hover:text-primary-hover">
              Register
            </Link>
          </p>
        </form>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Welcome back" description="Sign in to continue to your dashboard.">
          <div className="space-y-4">
            <div className="h-11 rounded-md border border-border bg-card" />
            <div className="h-11 rounded-md border border-border bg-card" />
            <div className="h-11 rounded-md bg-primary/15" />
          </div>
        </AuthShell>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}
