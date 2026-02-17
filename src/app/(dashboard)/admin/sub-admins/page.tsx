'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, UserCog, Shield, Trash2, Edit, Plus, Eye, EyeOff } from 'lucide-react'

const AVAILABLE_PERMISSIONS = [
  { name: 'season:write', label: 'Manage Seasons' },
  { name: 'rounds:write', label: 'Manage Rounds' },
  { name: 'markets:write', label: 'Manage Markets' },
  { name: 'teams:approve', label: 'Approve Teams' },
  { name: 'teams:manage', label: 'Manage Teams' },
  { name: 'users:manage', label: 'Manage Users' },
  { name: 'actuals:upload', label: 'Upload Actuals' },
  { name: 'scoring:run', label: 'Run Scoring' },
  { name: 'audit:view', label: 'View Audit Logs' },
  { name: 'support:manage', label: 'Manage Support Tickets' },
]

interface SubAdmin {
  id: string
  email: string
  firstName: string
  lastName: string
  hasFullAccess: boolean
  createdAt: string
  permissions: { permission: { name: string } }[]
}

export default function SubAdminsPage() {
  const [subAdmins, setSubAdmins] = useState<SubAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [hasFullAccess, setHasFullAccess] = useState(false)
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])

  useEffect(() => {
    fetchSubAdmins()
  }, [])

  const fetchSubAdmins = async () => {
    try {
      const res = await csrfFetch('/api/admin/sub-admins')
      if (res.ok) {
        const data = await res.json()
        setSubAdmins(data.subAdmins || [])
      }
    } catch (err) {
      clientLogger.error('Failed to fetch sub-admins:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (editingId) {
        const res = await csrfFetch(`/api/admin/sub-admins/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            firstName, 
            lastName, 
            hasFullAccess,
            permissions: hasFullAccess ? [] : selectedPermissions 
          }),
        })

        if (res.ok) {
          resetForm()
          fetchSubAdmins()
        }
      } else {
        const res = await csrfFetch('/api/admin/sub-admins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email, 
            firstName, 
            lastName, 
            password, 
            hasFullAccess,
            permissions: hasFullAccess ? [] : selectedPermissions 
          }),
        })

        if (res.ok) {
          resetForm()
          fetchSubAdmins()
        }
      }
    } catch (err) {
      clientLogger.error('Failed to save sub-admin:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (subAdmin: SubAdmin) => {
    setEditingId(subAdmin.id)
    setEmail(subAdmin.email)
    setFirstName(subAdmin.firstName)
    setLastName(subAdmin.lastName)
    setHasFullAccess(subAdmin.hasFullAccess)
    setSelectedPermissions(subAdmin.permissions.map(p => p.permission.name))
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this sub-admin?')) return

    try {
      const res = await csrfFetch(`/api/admin/sub-admins/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        fetchSubAdmins()
      }
    } catch (err) {
      clientLogger.error('Failed to delete sub-admin:', err)
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setEmail('')
    setFirstName('')
    setLastName('')
    setPassword('')
    setHasFullAccess(false)
    setSelectedPermissions([])
  }

  const togglePermission = (permName: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permName)
        ? prev.filter(p => p !== permName)
        : [...prev, permName]
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sub-Admin Management</h1>
          <p className="text-gray-600">Create and manage sub-admin accounts with delegated permissions</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Sub-Admin
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Sub-Admin' : 'Create Sub-Admin'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="subadmin@example.com"
                    disabled={!!editingId}
                    required
                  />
                </div>
                {!editingId && (
                  <div>
                    <Label>Password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Strong password"
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <Label>First Name</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-purple-50 border-purple-200">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasFullAccess}
                    onChange={(e) => setHasFullAccess(e.target.checked)}
                    className="w-5 h-5 rounded text-purple-600"
                  />
                  <div>
                    <p className="font-medium text-purple-900">Grant Full Access</p>
                    <p className="text-sm text-purple-700">
                      This sub-admin will have all admin permissions and act as a full administrator
                    </p>
                  </div>
                </label>
              </div>

              {!hasFullAccess && (
                <div>
                  <Label className="mb-2 block">Permissions</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {AVAILABLE_PERMISSIONS.map(perm => (
                      <label
                        key={perm.name}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                          selectedPermissions.includes(perm.name)
                            ? 'bg-blue-50 border-blue-300'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(perm.name)}
                          onChange={() => togglePermission(perm.name)}
                          className="rounded"
                        />
                        <span className="text-sm">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingId ? 'Update' : 'Create')}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {subAdmins.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UserCog className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Sub-Admins</h3>
            <p className="text-gray-500">Create sub-admin accounts to delegate administrative tasks</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {subAdmins.map((admin) => (
            <Card key={admin.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-purple-100 rounded-full">
                      <UserCog className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">
                          {admin.firstName} {admin.lastName}
                        </p>
                        {admin.hasFullAccess && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                            Full Access
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{admin.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex flex-wrap gap-1">
                      {admin.hasFullAccess ? (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                          All Permissions
                        </span>
                      ) : (
                        <>
                          {admin.permissions.slice(0, 3).map((p, i) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                              {AVAILABLE_PERMISSIONS.find(ap => ap.name === p.permission.name)?.label || p.permission.name}
                            </span>
                          ))}
                          {admin.permissions.length > 3 && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                              +{admin.permissions.length - 3} more
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(admin)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(admin.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

