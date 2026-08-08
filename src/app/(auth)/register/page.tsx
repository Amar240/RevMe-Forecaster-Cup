'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, School } from 'lucide-react'
import { csrfFetch } from '@/lib/csrf'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { AlertBanner } from '@/components/ui/alert-banner'
import { AuthShell } from '@/components/auth/auth-shell'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { COUNTRIES } from '@/lib/countries'
import { GoogleSignIn } from '@/components/auth/google-sign-in'

export const dynamic = 'force-dynamic'

type UniversityOption = { id: string; name: string; country: string | null; normalizedName: string }

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')
}

function looksSimilar(left: string, right: string) {
  const a = normalizeName(left)
  const b = normalizeName(right)
  if (!a || !b) return false
  if (a === b || a.includes(b) || b.includes(a)) return true
  const ignored = new Set(['the', 'and', 'of', 'university', 'college'])
  const aTokens = new Set(a.split(' ').filter((token) => token.length > 2 && !ignored.has(token)))
  const bTokens = new Set(b.split(' ').filter((token) => token.length > 2 && !ignored.has(token)))
  const shared = [...aTokens].filter((token) => bTokens.has(token)).length
  return shared > 0 && shared / Math.max(aTokens.size, bTokens.size) >= 0.5
}

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '', password: '', confirmPassword: '', firstName: '', lastName: '',
    role: 'STUDENT' as 'STUDENT' | 'SUPERVISOR', country: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [universities, setUniversities] = useState<UniversityOption[]>([])
  const [selectedUniversity, setSelectedUniversity] = useState('')
  const [customUniversityName, setCustomUniversityName] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [confirmedNoMatch, setConfirmedNoMatch] = useState(false)

  useEffect(() => {
    let cancelled = false
    void csrfFetch('/api/universities')
      .then(async (response) => {
        const data = await response.json() as { universities?: UniversityOption[] }
        if (!response.ok) throw new Error('Failed to load universities')
        if (!cancelled) setUniversities(data.universities ?? [])
      })
      .catch(() => { if (!cancelled) setUniversities([]) })
    return () => { cancelled = true }
  }, [])

  const university = universities.find((item) => item.id === selectedUniversity) ?? null
  const similarUniversities = useMemo(() => {
    if (selectedUniversity !== 'other' || customUniversityName.trim().length < 3) return []
    return universities.filter((item) => {
      const countryMatches = !formData.country || !item.country || item.country === formData.country
      return countryMatches && looksSimilar(customUniversityName, item.normalizedName || item.name)
    }).slice(0, 5)
  }, [customUniversityName, formData.country, selectedUniversity, universities])

  const validateDetails = () => {
    if (formData.password !== formData.confirmPassword) return 'Passwords do not match'
    if (formData.password.length < 8) return 'Password must be at least 8 characters'
    if (!selectedUniversity) return 'Please select your university'
    if (selectedUniversity === 'other' && !customUniversityName.trim()) return 'Please enter your university name'
    if (selectedUniversity === 'other' && !formData.country) return 'Please select your country'
    if (selectedUniversity === 'other' && similarUniversities.length > 0 && !confirmedNoMatch) {
      return 'Select a suggested university or confirm that none of them match.'
    }
    return null
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    const validationError = validateDetails()
    if (validationError) { setError(validationError); return }
    if (!reviewing) { setReviewing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); return }

    setLoading(true)
    try {
      const other = selectedUniversity === 'other'
      const response = await csrfFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
          universitySelectionMode: other ? 'OTHER' : 'EXISTING',
          universityConfirmed: true,
          ...(other
            ? { universityName: customUniversityName.trim(), country: formData.country, confirmedNoMatchingUniversity: confirmedNoMatch || undefined }
            : { universityId: selectedUniversity }),
        }),
      })
      const data = await response.json()
      if (!response.ok) { setError(data.message || 'Registration failed'); return }
      router.push(`/verify-email?email=${encodeURIComponent(data.email || formData.email)}&sent=${data.emailSent === false ? '0' : '1'}`)
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={reviewing ? 'Check your registration' : 'Create your account'}
      description={reviewing ? 'Confirm your university carefully before creating the account.' : 'Enter your details, then review them before submitting.'}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {!reviewing ? <GoogleSignIn /> : null}
        {error ? <AlertBanner variant="error" className="shadow-none">{error}</AlertBanner> : null}

        {reviewing ? (
          <>
            <AlertBanner variant="warning" title="University affects your teams and competition records">
              Check the university and role below. An administrator is required to correct them after teams or imports are linked.
            </AlertBanner>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-start gap-3 border-b border-border bg-primary-soft p-4">
                <School className="mt-0.5 h-5 w-5 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">University</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{university?.name ?? customUniversityName.trim()}</p>
                  <p className="text-sm text-text-secondary">{university?.country ?? formData.country}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setReviewing(false)}>Change university</Button>
              </div>
              <dl className="divide-y divide-border text-sm">
                <div className="grid grid-cols-[7rem_1fr] gap-3 p-4"><dt className="text-text-muted">Name</dt><dd className="font-medium text-foreground">{formData.firstName} {formData.lastName}</dd></div>
                <div className="grid grid-cols-[7rem_1fr] gap-3 p-4"><dt className="text-text-muted">Email</dt><dd className="break-all font-medium text-foreground">{formData.email}</dd></div>
                <div className="grid grid-cols-[7rem_1fr] gap-3 p-4"><dt className="text-text-muted">Role</dt><dd className="font-medium text-foreground">{formData.role === 'SUPERVISOR' ? 'Supervisor' : 'Student'}</dd></div>
              </dl>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              <CheckCircle2 className="mr-2 h-4 w-4" />{loading ? 'Creating account…' : 'Confirm registration'}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setReviewing(false)} disabled={loading}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to details
            </Button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="firstName">First name</Label><Input id="firstName" value={formData.firstName} onChange={(event) => setFormData({ ...formData, firstName: event.target.value })} required /></div>
              <div className="space-y-2"><Label htmlFor="lastName">Last name</Label><Input id="lastName" value={formData.lastName} onChange={(event) => setFormData({ ...formData, lastName: event.target.value })} required /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" placeholder="you@university.edu" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} required /></div>
            <div className="space-y-2">
              <Label htmlFor="universityName">University</Label>
              <select id="universityName" value={selectedUniversity} onChange={(event) => { setSelectedUniversity(event.target.value); setConfirmedNoMatch(false); if (event.target.value !== 'other') { setCustomUniversityName(''); setFormData((current) => ({ ...current, country: '' })) } }} className="flex h-11 w-full rounded-md border border-input bg-card px-3.5 py-2 text-[15px] text-foreground shadow-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" required>
                <option value="" disabled>Select your university</option>
                {universities.map((item) => <option key={item.id} value={item.id}>{item.name}{item.country ? ` — ${item.country}` : ''}</option>)}
                <option value="other">Other — my university is not listed</option>
              </select>
              {university ? <p className="text-xs text-text-muted">Country: {university.country ?? 'Not recorded'}. RevME uses the university record as the source of truth.</p> : null}
            </div>
            {selectedUniversity === 'other' ? (
              <div className="space-y-4 rounded-lg border border-border bg-surface-secondary p-4">
                <div className="space-y-2"><Label htmlFor="customUniversity">University name</Label><Input id="customUniversity" value={customUniversityName} onChange={(event) => { setCustomUniversityName(event.target.value); setConfirmedNoMatch(false) }} required /></div>
                <div className="space-y-2"><Label htmlFor="country">Country</Label><Select value={formData.country} onValueChange={(country) => { setFormData({ ...formData, country }); setConfirmedNoMatch(false) }}><SelectTrigger id="country"><SelectValue placeholder="Select your country" /></SelectTrigger><SelectContent theme="light">{COUNTRIES.map((country) => <SelectItem key={country} value={country}>{country}</SelectItem>)}</SelectContent></Select></div>
                {similarUniversities.length > 0 ? (
                  <AlertBanner variant="warning" title="Is your university already listed?">
                    <div className="mt-2 space-y-2">
                      {similarUniversities.map((item) => <Button key={item.id} type="button" variant="outline" size="sm" className="mr-2" onClick={() => { setSelectedUniversity(item.id); setCustomUniversityName(''); setFormData((current) => ({ ...current, country: '' })); setConfirmedNoMatch(false) }}>{item.name}{item.country ? ` — ${item.country}` : ''}</Button>)}
                      <label className="flex items-start gap-2 pt-2 text-sm"><Checkbox checked={confirmedNoMatch} onCheckedChange={(checked) => setConfirmedNoMatch(checked === true)} /><span>None of these is my university. Continue with the name I entered.</span></label>
                    </div>
                  </AlertBanner>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-2"><Label>I am a</Label><div className="grid grid-cols-2 gap-3">{(['STUDENT', 'SUPERVISOR'] as const).map((role) => <Button key={role} type="button" variant={formData.role === role ? 'default' : 'outline'} onClick={() => setFormData({ ...formData, role })}>{role === 'STUDENT' ? 'Student' : 'Supervisor'}</Button>)}</div></div>
            <div className="space-y-2"><Label htmlFor="password">Password</Label><PasswordInput id="password" value={formData.password} onChange={(event) => setFormData({ ...formData, password: event.target.value })} required /></div>
            <div className="space-y-2"><Label htmlFor="confirmPassword">Confirm password</Label><PasswordInput id="confirmPassword" value={formData.confirmPassword} onChange={(event) => setFormData({ ...formData, confirmPassword: event.target.value })} required /></div>
            <Button type="submit" className="w-full">Review registration</Button>
            <p className="text-center text-sm text-text-secondary">Already have an account? <Link href="/login" className="font-medium text-primary hover:text-primary-hover">Sign in</Link></p>
          </>
        )}
      </form>
    </AuthShell>
  )
}
