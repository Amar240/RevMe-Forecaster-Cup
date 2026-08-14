'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, UserCog, Shield, Trash2, Edit, Plus, Eye, EyeOff } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable } from '@/components/ui/data-table'
import { toast } from 'sonner'

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
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

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
      toast.error('Failed to load sub-admins')
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
      toast.error('Failed to save sub-admin')
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

  const executeDelete = async (id: string) => {
    try {
      const res = await csrfFetch(`/api/admin/sub-admins/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        fetchSubAdmins()
      }
    } catch (err) {
      clientLogger.error('Failed to delete sub-admin:', err)
      toast.error('Failed to delete sub-admin')
    } finally {
      setDeleteTarget(null)
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
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 bg-muted rounded w-56" />
            <div className="h-4 bg-surface-secondary rounded w-80" />
          </div>
          <div className="h-9 bg-muted rounded w-32" />
        </div>
        <div className="h-10 bg-surface-secondary rounded w-full max-w-sm" />
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-surface-secondary border-b px-4 py-3 flex gap-4">
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-4 bg-muted rounded w-1/4" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 border-b last:border-0 flex gap-4">
              <div className="h-4 bg-surface-secondary rounded w-1/3" />
              <div className="h-4 bg-surface-secondary rounded w-1/4" />
              <div className="h-4 bg-surface-secondary rounded w-1/5" />
              <div className="h-4 bg-surface-secondary rounded w-1/6" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sub-Admin Management"
        description="Create and manage sub-admin accounts with delegated permissions"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Sub-Admin
          </Button>
        }
      />

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
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
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

              <div className="p-4 border rounded-lg bg-accent-soft border-accent/30">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasFullAccess}
                    onChange={(e) => setHasFullAccess(e.target.checked)}
                    className="w-5 h-5 rounded text-accent"
                  />
                  <div>
                    <p className="font-medium text-accent">Grant Full Access</p>
                    <p className="text-sm text-accent">
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
                            ? 'bg-info-background border-info/30'
                            : 'hover:bg-surface-secondary'
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

      <DataTable
        data={subAdmins}
        columns={[
          {
            key: 'firstName',
            header: 'Name',
            sortable: true,
            render: (admin: SubAdmin) => (
              <span className="font-medium">{admin.firstName} {admin.lastName}</span>
            ),
          },
          { key: 'email', header: 'Email', sortable: true },
          {
            key: 'permissions',
            header: 'Permissions',
            render: (admin: SubAdmin) =>
              admin.hasFullAccess ? (
                <span className="px-2 py-0.5 bg-accent-soft text-accent text-xs rounded-full font-medium">
                  Full Access
                </span>
              ) : (
                <span className="text-sm text-text-secondary">
                  {admin.permissions.length} permission{admin.permissions.length !== 1 ? 's' : ''}
                </span>
              ),
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (admin: SubAdmin) => (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(admin)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(admin.id)}
                  className="text-error hover:text-error hover:bg-error-background"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ),
          },
        ]}
        searchKeys={['firstName', 'lastName', 'email']}
        searchPlaceholder="Search sub-admins..."
        pageSize={10}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Remove Sub-Admin"
        description="Are you sure you want to remove this sub-admin?"
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => { if (deleteTarget) executeDelete(deleteTarget) }}
      />
    </div>
  )
}

