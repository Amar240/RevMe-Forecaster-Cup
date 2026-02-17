'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pencil, Check, X, Users, Download } from 'lucide-react'

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
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  if (!user) return null

  const team = user.teamMemberships[0]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {message && (
        <div className={`px-4 py-2 rounded-md text-sm ${message.includes('success') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          {message}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </div>
            {!editing && user.role === 'STUDENT' && (
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
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium">{user.firstName} {user.lastName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Role</p>
                <p className="font-medium">{user.role}</p>
              </div>
              {user.university && (
                <div>
                  <p className="text-sm text-gray-500">University</p>
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
              <p className="text-sm text-gray-500">Team Name</p>
              <p className="font-medium">{team.team.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Team ID</p>
              <p className="font-medium">{team.team.displayId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Supervisor</p>
              <p className="font-medium">{team.team.supervisor.firstName} {team.team.supervisor.lastName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Role in Team</p>
              <p className="font-medium">
                {team.isSubmitter ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Submitter
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Member
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {user.role === 'STUDENT' && (
        <Card>
          <CardHeader>
            <CardTitle>Competition Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Rules Acknowledged</p>
              <p className="font-medium">
                {user.rulesAcknowledgedAt ? (
                  <span className="text-green-600">
                    Yes - {new Date(user.rulesAcknowledgedAt).toLocaleDateString()}
                  </span>
                ) : (
                  <span className="text-amber-600">Not yet acknowledged</span>
                )}
              </p>
            </div>
            <Button variant="outline" onClick={handleDownloadHistory}>
              <Download className="h-4 w-4 mr-2" />
              Download Submission History (CSV)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

