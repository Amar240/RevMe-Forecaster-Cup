'use client'

import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Pencil, Check, X, Users, Download, User, Shield, FileText } from 'lucide-react'
import { PageLoader } from '@/components/ui/page-loader'
import { toast } from 'sonner'

interface UserData {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  rulesAcknowledgedAt: string | null
  university: { name: string } | null
  teamMemberships: Array<{
    isSubmitter: boolean
    team: {
      name: string
      displayId: string
      supervisor: { firstName: string; lastName: string }
    }
  }>
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

  useEffect(() => {
    fetchUser()
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

  if (loading) {
    return <PageLoader message="Loading settings…" />
  }

  if (!user) return null

  const team = user.teamMemberships[0]

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'security' as const, label: 'Security', icon: Shield },
    { id: 'account' as const, label: 'Account', icon: FileText },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && message && (
        <div className={`px-4 py-2 rounded-md text-sm ${message.includes('success') ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
          {message}
        </div>
      )}

      {activeTab === 'security' && passwordMessage && (
        <div className={`px-4 py-2 rounded-md text-sm ${passwordMessage.includes('success') ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
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
                    <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                    <p className="font-medium">{user.firstName} {user.lastName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                    <p className="font-medium">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Role</p>
                    <p className="font-medium">{user.role}</p>
                  </div>
                  {user.university && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">University</p>
                      <p className="font-medium">{user.university.name}</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

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
                  <p className="text-sm text-gray-500 dark:text-gray-400">Team Name</p>
                  <p className="font-medium">{team.team.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Team ID</p>
                  <p className="font-medium">{team.team.displayId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Supervisor</p>
                  <p className="font-medium">{team.team.supervisor.firstName} {team.team.supervisor.lastName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Role in Team</p>
                  <p className="font-medium">
                    {team.isSubmitter ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                        Submitter
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300">
                        Member
                      </span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {activeTab === 'security' && (
        <Card>
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
        </Card>
      )}

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
                  <p className="text-sm text-gray-500 dark:text-gray-400">Rules Acknowledged</p>
                  <p className="font-medium">
                    {user.rulesAcknowledgedAt ? (
                      <span className="text-green-600 dark:text-green-400">
                        Yes - {new Date(user.rulesAcknowledgedAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">Not yet acknowledged</span>
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

