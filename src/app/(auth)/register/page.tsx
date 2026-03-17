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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { COUNTRIES } from '@/lib/countries'

export const dynamic = 'force-dynamic'

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: 'STUDENT' as 'STUDENT' | 'SUPERVISOR',
    universityName: '',
    country: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (!formData.country) {
      setError('Please select your country')
      return
    }

    setLoading(true)

    try {
      const res = await csrfFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Registration failed')
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
    <AuthShell title="Create your account" description="Register to start your competition profile.">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <AlertBanner variant="error" className="shadow-none">
              {error}
            </AlertBanner>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-sm font-medium text-text-secondary">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-sm font-medium text-text-secondary">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-text-secondary">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@university.edu"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
              <Label htmlFor="universityName" className="text-sm font-medium text-text-secondary">University</Label>
              <Input
                id="universityName"
                placeholder="Your university name"
                value={formData.universityName}
                onChange={(e) => setFormData({ ...formData, universityName: e.target.value })}
                required
              />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country" className="text-sm font-medium text-text-secondary">Country</Label>
            <Select
              value={formData.country}
              onValueChange={(country) => setFormData({ ...formData, country })}
            >
              <SelectTrigger id="country" aria-label="Country">
                <SelectValue placeholder="Select your country" />
              </SelectTrigger>
              <SelectContent theme="light">
                {COUNTRIES.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-text-secondary">I am a</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'STUDENT' })}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  formData.role === 'STUDENT'
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-secondary text-text-secondary hover:border-primary/30 hover:bg-primary-soft'
                }`}
                aria-pressed={formData.role === 'STUDENT'}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'SUPERVISOR' })}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  formData.role === 'SUPERVISOR'
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-secondary text-text-secondary hover:border-primary/30 hover:bg-primary-soft'
                }`}
                aria-pressed={formData.role === 'SUPERVISOR'}
              >
                Supervisor
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-text-secondary">Password</Label>
            <PasswordInput
              id="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium text-text-secondary">Confirm Password</Label>
            <PasswordInput
              id="confirmPassword"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
          <p className="text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
              Sign in
            </Link>
          </p>
        </form>
    </AuthShell>
  )
}
