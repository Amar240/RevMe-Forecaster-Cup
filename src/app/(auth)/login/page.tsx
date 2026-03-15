'use client'

import { csrfFetch } from '@/lib/csrf'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { AlertBanner } from '@/components/ui/alert-banner'
import { AuthShell } from '@/components/auth/auth-shell'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await csrfFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Login failed')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Welcome back" description="Sign in to continue to your dashboard.">
        <form onSubmit={handleSubmit} className="space-y-5">
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
