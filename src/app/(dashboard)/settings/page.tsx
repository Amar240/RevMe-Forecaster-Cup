'use client'

import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Pencil, Check, X, Users, Download, User, Shield, FileText, School } from 'lucide-react'
import { PageLoader } from '@/components/ui/page-loader'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { disconnectGoogle } from '@/features/auth/api'

interface UserData {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  rulesAcknowledgedAt: string | null
  university: { id: string; name: string; country: string | null } | null
  teamMemberships: Array<{
    isSubmitter: boolean
    team: {
      name: string
      displayId: string
      supervisor: { firstName: string; lastName: string }
    }
  }>
  loginMethods: { hasPassword: boolean; google: { connected: boolean; email: string | null } }
  affiliationCorrection: {
    eligible: boolean
    currentUniversityId: string | null
    blockers: Array<{ code: string; count: number; message: string; link: string }>
  } | null
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'account'>('profile')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [universities, setUniversities] = useState<Array<{ id: string; name: string; country: string | null }>>([])
  const [affiliationOpen, setAffiliationOpen] = useState(false)
  const [targetUniversityId, setTargetUniversityId] = useState('')
  const [affiliationReason, setAffiliationReason] = useState('')
  const [correctingAffiliation, setCorrectingAffiliation] = useState(false)

  useEffect(() => {
    fetchUser()
    void csrfFetch('/api/universities').then((response) => response.json()).then((data) => setUniversities(data.universities ?? [])).catch(() => setUniversities([]))
  }, [])

  const fetchUser = async () => {
    try {
      const res = await csrfFetch('/api/users/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        setFirstName(data.user.firstName)
        setLastName(data.user.lastName)
      }
    } catch (error) {
      clientLogger.error('Failed to fetch user:', error)
      toast.error('Failed to load your profile')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    try {
      const res = await csrfFetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName }),
      })

      if (res.ok) {
        const data = await res.json()
        setUser((prev) => prev ? { ...prev, firstName: data.user.firstName, lastName: data.user.lastName } : null)
        setEditing(false)
        setMessage('Profile updated successfully')
        setTimeout(() => setMessage(''), 3000)
      } else {
        const data = await res.json()
        setMessage(data.message || 'Failed to update profile')
      }
    } catch {
      setMessage('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFirstName(user?.firstName || '')
    setLastName(user?.lastName || '')
    setEditing(false)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMessage('')
    if (newPassword.length < 8) {
      setPasswordMessage('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage('New passwords do not match')
      return
    }
    setChangingPassword(true)
    try {
      const res = await csrfFetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setPasswordMessage('Password updated successfully')
        toast.success('Password updated successfully')
        setTimeout(() => setPasswordMessage(''), 3000)
      } else {
        setPasswordMessage(data.message || 'Failed to change password')
      }
    } catch {
      setPasswordMessage('An error occurred')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleDownloadHistory = async () => {
    try {
      const res = await csrfFetch('/api/submissions/export')
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'submission-history.csv'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        a.remove()
      }
    } catch (error) {
      clientLogger.error('Failed to download:', error)
      toast.error('Failed to download data')
    }
  }

  const handleDisconnectGoogle = async () => { setDisconnecting(true); try { await disconnectGoogle(); setUser((current) => current ? { ...current, loginMethods: { ...current.loginMethods, google: { connected: false, email: null } } } : current); setDisconnectOpen(false); toast.success('Google disconnected') } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to disconnect Google') } finally { setDisconnecting(false) } }

  const correctOwnAffiliation = async () => {
    if (!targetUniversityId) return
    setCorrectingAffiliation(true)
    try {
      const response = await csrfFetch('/api/users/me/affiliation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUniversityId, universityConfirmed: true, reason: affiliationReason }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to correct university')
      setAffiliationOpen(false)
      setTargetUniversityId('')
      setAffiliationReason('')
      await fetchUser()
      toast.success('University affiliation corrected')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to correct university')
    } finally {
      setCorrectingAffiliation(false)
    }
  }

  if (loading) {
    return <PageLoader message="Loading settings..." />
  }

  if (!user) return null

  const team = user.teamMemberships[0]

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'security' as const, label: 'Security', icon: Shield },
    { id: 'account' as const, label: 'Account', icon: FileText },
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">Manage your profile, account security, and competition access.</p>
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-surface-secondary p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-text-secondary hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && message && (
        <div className={`rounded-md px-4 py-2 text-sm ${message.includes('success') ? 'bg-success-background text-success' : 'bg-error-background text-error'}`}>
          {message}
        </div>
      )}

      {activeTab === 'security' && passwordMessage && (
        <div className={`rounded-md px-4 py-2 text-sm ${passwordMessage.includes('success') ? 'bg-success-background text-success' : 'bg-error-background text-error'}`}>
          {passwordMessage}
        </div>
      )}

      {activeTab === 'profile' && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Your account details</CardDescription>
                </div>
                {!editing && (
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={handleSave} disabled={saving}>
                      <Check className="h-4 w-4 mr-2" />
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button variant="outline" onClick={handleCancel}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-text-muted">Name</p>
                    <p className="font-medium text-foreground">{user.firstName} {user.lastName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-muted">Email</p>
                    <p className="font-medium text-foreground">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-muted">Role</p>
                    <Badge variant="neutral" className="mt-1 w-fit">{user.role}</Badge>
                  </div>
                  {user.university && (
                    <div>
                      <p className="text-sm text-text-muted">University</p>
                      <p className="font-medium text-foreground">{user.university.name}</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {user.role === 'SUPERVISOR' ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><School className="h-5 w-5" /> University affiliation</CardTitle>
                <CardDescription>Correct a university selected incorrectly during registration.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {user.affiliationCorrection?.eligible ? (
                  <>
                    <p className="text-sm text-text-secondary">Because no teams, imports, pending requests, or unresolved tickets are linked to your account, you can correct this once without administrator help.</p>
                    <Button variant="outline" onClick={() => setAffiliationOpen(true)}>Correct my university</Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-text-secondary">An administrator must correct your affiliation so related records move together safely.</p>
                    <ul className="space-y-1 text-sm text-text-muted">
                      {user.affiliationCorrection?.blockers.map((blocker) => <li key={blocker.code}>• {blocker.message}</li>)}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {team && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Team Assignment
                </CardTitle>
                <CardDescription>Your team details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-text-muted">Team Name</p>
                  <p className="font-medium text-foreground">{team.team.name}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted">Team ID</p>
                  <p className="font-medium text-foreground">{team.team.displayId}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted">Supervisor</p>
                  <p className="font-medium text-foreground">{team.team.supervisor.firstName} {team.team.supervisor.lastName}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted">Role in Team</p>
                  <div className="mt-1">
                    {team.isSubmitter ? (
                      <Badge variant="info">Submitter</Badge>
                    ) : (
                      <Badge variant="secondary">Member</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {activeTab === 'security' && (
        <div className="space-y-6"><Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your password to keep your account secure</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <PasswordInput
                  id="currentPassword"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <PasswordInput
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <PasswordInput
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                />
              </div>
              <Button type="submit" disabled={changingPassword}>
                {changingPassword ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </CardContent>
        </Card><Card><CardHeader><CardTitle>Connected accounts</CardTitle><CardDescription>Manage external sign-in methods.</CardDescription></CardHeader><CardContent>{user.loginMethods.google.connected ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">Connected: Google</p><p className="text-sm text-text-secondary">{user.loginMethods.google.email}</p></div><div><Button variant="outline" disabled={!user.loginMethods.hasPassword} onClick={() => setDisconnectOpen(true)}>Disconnect Google</Button>{!user.loginMethods.hasPassword && <p className="mt-2 max-w-xs text-xs text-text-muted">Set a password using password reset before disconnecting your only sign-in method.</p>}</div></div> : <p className="text-sm text-text-secondary">No Google account connected.</p>}</CardContent></Card></div>
      )}
      <ConfirmDialog open={disconnectOpen} onOpenChange={setDisconnectOpen} title="Disconnect Google?" description="You will continue signing in with your RevME password." confirmLabel="Disconnect" loading={disconnecting} onConfirm={handleDisconnectGoogle}/>
      <ConfirmDialog
        open={affiliationOpen}
        onOpenChange={setAffiliationOpen}
        title="Confirm university correction"
        description="Review the university carefully. This self-service option is available only before related competition records exist."
        confirmLabel="Correct university"
        loading={correctingAffiliation}
        confirmDisabled={!targetUniversityId || affiliationReason.trim().length < 5}
        onConfirm={() => void correctOwnAffiliation()}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="self-affiliation-university">Correct university</Label>
            <select id="self-affiliation-university" className="flex h-11 w-full rounded-md border border-input bg-card px-3.5 text-foreground" value={targetUniversityId} onChange={(event) => setTargetUniversityId(event.target.value)}>
              <option value="">Select university</option>
              {universities.filter((university) => university.id !== user.university?.id).map((university) => <option key={university.id} value={university.id}>{university.name}{university.country ? ` — ${university.country}` : ''}</option>)}
            </select>
          </div>
          <div className="space-y-2"><Label htmlFor="self-affiliation-reason">Why is this correction needed?</Label><Input id="self-affiliation-reason" value={affiliationReason} onChange={(event) => setAffiliationReason(event.target.value)} maxLength={500} placeholder="Example: I selected the wrong university during registration" /></div>
        </div>
      </ConfirmDialog>

      {activeTab === 'account' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Data & History</CardTitle>
              <CardDescription>Download your submission history</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={handleDownloadHistory}>
                <Download className="h-4 w-4 mr-2" />
                Download Submission History (CSV)
              </Button>
            </CardContent>
          </Card>
          {user.role === 'STUDENT' && (
            <Card>
              <CardHeader>
                <CardTitle>Competition Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-text-muted">Rules Acknowledged</p>
                  <p className="font-medium">
                    {user.rulesAcknowledgedAt ? (
                      <span className="text-success">
                        Yes - {new Date(user.rulesAcknowledgedAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-warning">Not yet acknowledged</span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
