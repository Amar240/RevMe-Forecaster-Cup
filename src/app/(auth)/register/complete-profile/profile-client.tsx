'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, School } from 'lucide-react'
import { csrfFetch } from '@/lib/csrf'
import { COUNTRIES } from '@/lib/countries'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type UniversityOption = { id: string; name: string; country: string | null; normalizedName: string }
const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')
function similar(left: string, right: string) {
  const a = normalize(left); const b = normalize(right)
  if (!a || !b) return false
  if (a === b || a.includes(b) || b.includes(a)) return true
  const ignored = new Set(['the', 'and', 'of', 'university', 'college'])
  const at = new Set(a.split(' ').filter((token) => token.length > 2 && !ignored.has(token)))
  const bt = new Set(b.split(' ').filter((token) => token.length > 2 && !ignored.has(token)))
  const overlap = [...at].filter((token) => bt.has(token)).length
  return overlap > 0 && overlap / Math.max(at.size, bt.size) >= 0.5
}

export function CompleteGoogleProfile({ identity }: { identity: { email: string; firstName: string; lastName: string } }) {
  const router = useRouter()
  const [role, setRole] = useState<'STUDENT' | 'SUPERVISOR'>('STUDENT')
  const [universities, setUniversities] = useState<UniversityOption[]>([])
  const [universityId, setUniversityId] = useState('')
  const [universityName, setUniversityName] = useState('')
  const [country, setCountry] = useState('')
  const [confirmedNoMatch, setConfirmedNoMatch] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void csrfFetch('/api/universities').then(async (response) => {
      const data = await response.json()
      if (!response.ok) throw new Error('Failed to load universities')
      setUniversities(data.universities ?? [])
    }).catch(() => setUniversities([]))
  }, [])

  const selected = universities.find((item) => item.id === universityId) ?? null
  const suggestions = useMemo(() => universityId === 'other'
    ? universities.filter((item) => (!country || !item.country || item.country === country) && similar(universityName, item.normalizedName || item.name)).slice(0, 5)
    : [], [country, universities, universityId, universityName])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('')
    const other = universityId === 'other'
    if (!universityId) { setError('Select your university.'); return }
    if (other && (!universityName.trim() || !country)) { setError('Enter your university name and country.'); return }
    if (other && suggestions.length > 0 && !confirmedNoMatch) { setError('Select a suggested university or confirm that none match.'); return }
    if (!reviewing) { setReviewing(true); return }
    setLoading(true)
    try {
      const response = await csrfFetch('/api/auth/google/complete-profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          universitySelectionMode: other ? 'OTHER' : 'EXISTING',
          universityConfirmed: true,
          ...(other ? { universityName: universityName.trim(), country, confirmedNoMatchingUniversity: confirmedNoMatch || undefined } : { universityId }),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Registration failed')
      router.push('/dashboard'); router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Registration failed')
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}
      {reviewing ? (
        <>
          <AlertBanner variant="warning" title="Confirm your university carefully">Your university controls team eligibility and reporting. An administrator is required to correct it after related records exist.</AlertBanner>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-start gap-3 border-b border-border bg-primary-soft p-4"><School className="mt-0.5 h-5 w-5 text-primary" /><div className="flex-1"><p className="text-xs uppercase tracking-wide text-text-muted">University</p><p className="text-lg font-semibold text-foreground">{selected?.name ?? universityName.trim()}</p><p className="text-sm text-text-secondary">{selected?.country ?? country}</p></div><Button type="button" size="sm" variant="outline" onClick={() => setReviewing(false)}>Change</Button></div>
            <dl className="divide-y divide-border text-sm"><div className="grid grid-cols-[6rem_1fr] gap-3 p-4"><dt className="text-text-muted">Name</dt><dd>{identity.firstName} {identity.lastName}</dd></div><div className="grid grid-cols-[6rem_1fr] gap-3 p-4"><dt className="text-text-muted">Email</dt><dd className="break-all">{identity.email}</dd></div><div className="grid grid-cols-[6rem_1fr] gap-3 p-4"><dt className="text-text-muted">Role</dt><dd>{role === 'STUDENT' ? 'Student' : 'Supervisor'}</dd></div></dl>
          </div>
          <Button className="w-full" disabled={loading}><CheckCircle2 className="mr-2 h-4 w-4" />{loading ? 'Creating account…' : 'Confirm registration'}</Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setReviewing(false)}><ArrowLeft className="mr-2 h-4 w-4" />Back to details</Button>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2"><div><Label>First name</Label><Input value={identity.firstName} readOnly /></div><div><Label>Last name</Label><Input value={identity.lastName} readOnly /></div></div>
          <div><Label>Email</Label><Input value={identity.email} readOnly /></div>
          <div><Label htmlFor="google-university">University</Label><select id="google-university" className="flex h-11 w-full rounded-md border border-input bg-card px-3.5 text-foreground" value={universityId} onChange={(event) => { setUniversityId(event.target.value); setConfirmedNoMatch(false) }} required><option value="">Select your university</option>{universities.map((item) => <option key={item.id} value={item.id}>{item.name}{item.country ? ` — ${item.country}` : ''}</option>)}<option value="other">Other — my university is not listed</option></select>{selected ? <p className="mt-1 text-xs text-text-muted">Country: {selected.country ?? 'Not recorded'}</p> : null}</div>
          {universityId === 'other' ? <div className="space-y-4 rounded-lg border border-border bg-surface-secondary p-4"><div><Label htmlFor="google-university-name">University name</Label><Input id="google-university-name" value={universityName} onChange={(event) => { setUniversityName(event.target.value); setConfirmedNoMatch(false) }} required /></div><div><Label htmlFor="google-country">Country</Label><select id="google-country" className="flex h-11 w-full rounded-md border border-input bg-card px-3.5 text-foreground" value={country} onChange={(event) => { setCountry(event.target.value); setConfirmedNoMatch(false) }} required><option value="">Select country</option>{COUNTRIES.map((item) => <option key={item}>{item}</option>)}</select></div>{suggestions.length > 0 ? <AlertBanner variant="warning" title="Is your university already listed?"><div className="mt-2 space-y-2">{suggestions.map((item) => <Button key={item.id} type="button" size="sm" variant="outline" className="mr-2" onClick={() => { setUniversityId(item.id); setUniversityName(''); setCountry(''); setConfirmedNoMatch(false) }}>{item.name}</Button>)}<label className="flex items-start gap-2 pt-2"><Checkbox checked={confirmedNoMatch} onCheckedChange={(checked) => setConfirmedNoMatch(checked === true)} /><span className="text-sm">None of these matches.</span></label></div></AlertBanner> : null}</div> : null}
          <div><Label>I am a</Label><div className="grid grid-cols-2 gap-3">{(['STUDENT', 'SUPERVISOR'] as const).map((item) => <Button key={item} type="button" variant={role === item ? 'default' : 'outline'} onClick={() => setRole(item)}>{item === 'STUDENT' ? 'Student' : 'Supervisor'}</Button>)}</div></div>
          <Button className="w-full">Review registration</Button>
        </>
      )}
    </form>
  )
}
