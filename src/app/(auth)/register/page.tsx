'use client'

import { csrfFetch } from '@/lib/csrf'

import { useEffect, useState } from 'react'
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
    country: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [universities, setUniversities] = useState<{ id: string; name: string }[]>([])
  const [selectedUniversity, setSelectedUniversity] = useState('')
  const [customUniversityName, setCustomUniversityName] = useState('')

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const res = await fetch('/api/universities', {
          credentials: 'same-origin',
        })
        const data = await res.json() as { universities?: { id: string; name: string }[] }

        if (!cancelled) {
          setUniversities(data.universities || [])
        }
      } catch {
        if (!cancelled) {
          setUniversities([])
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

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

    if (!selectedUniversity) {
      setError('Please select your university')
      return
    }

    if (selectedUniversity === 'other' && !customUniversityName.trim()) {
      setError('Please enter your university name')
      return
    }

    if (!formData.country) {
      setError('Please select your country')
      return
    }

    setLoading(true)

    try {
      const payload = {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: formData.role,
        country: formData.country,
        universitySelectionMode: selectedUniversity === 'other' ? 'OTHER' as const : 'EXISTING' as const,
        ...(selectedUniversity === 'other'
          ? { universityName: customUniversityName.trim() }
          : { universityId: selectedUniversity }),
      }

      const res = await csrfFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Registration failed')
        return
      }

      const nextEmail = encodeURIComponent(data.email || formData.email)
      const emailSent = data.emailSent === false ? '0' : '1'
      router.push(`/verify-email?email=${nextEmail}&sent=${emailSent}`)
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
            <select
              id="universityName"
              value={selectedUniversity}
              onChange={(e) => {
                const value = e.target.value
                setSelectedUniversity(value)
                if (value !== 'other') {
                  setCustomUniversityName('')
                }
              }}
              className="flex h-11 w-full rounded-md border border-input bg-card px-3.5 py-2 text-[15px] text-foreground shadow-sm transition-[border-color,box-shadow,background-color] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
              required
            >
              <option value="" disabled>
                Select your university
              </option>
              {universities.map((university) => (
                <option key={university.id} value={university.id}>
                  {university.name}
                </option>
              ))}
              <option value="other">Other</option>
            </select>
            {selectedUniversity === 'other' && (
              <Input
                placeholder="Enter your university name"
                value={customUniversityName}
                onChange={(e) => {
                  setCustomUniversityName(e.target.value)
                }}
                required
              />
            )}
            <p className="text-xs text-text-muted">
              Select your university from the list. Choose Other if yours is not listed.
            </p>
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
