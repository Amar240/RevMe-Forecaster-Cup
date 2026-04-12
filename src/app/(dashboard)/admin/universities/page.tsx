'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, Edit, Plus, Trash2 } from 'lucide-react'
import { PageLoader } from '@/components/ui/page-loader'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface University {
  id: string
  name: string
  normalizedName: string | null
  isListed: boolean
  country: string | null
  _count: { users: number; teams: number }
  canDelete: boolean
  deleteBlockedReason: string | null
}

export default function AdminUniversitiesPage() {
  const [universities, setUniversities] = useState<University[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', country: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingTarget, setEditingTarget] = useState<University | null>(null)
  const [approveTarget, setApproveTarget] = useState<University | null>(null)
  const [syncTarget, setSyncTarget] = useState<University | null>(null)
  const [syncTargetUniversityId, setSyncTargetUniversityId] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<University | null>(null)

  useEffect(() => {
    fetchUniversities()
  }, [])

  const fetchUniversities = async () => {
    try {
      const res = await csrfFetch('/api/admin/universities')
      if (res.ok) {
        const data = await res.json()
        setUniversities(data.universities || [])
      }
    } catch (err) {
      clientLogger.error('Failed to fetch universities:', err)
      toast.error('Failed to load universities')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const res = await csrfFetch(
        editingTarget ? `/api/admin/universities/${editingTarget.id}` : '/api/admin/universities',
        {
          method: editingTarget ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        }
      )

      if (res.ok) {
        toast.success(editingTarget ? 'University updated successfully' : 'University added successfully')
        resetForm()
        void fetchUniversities()
      } else {
        const data = await res.json()
        setError(data.message || (editingTarget ? 'Failed to update university' : 'Failed to add university'))
      }
    } catch {
      setError('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (university: University) => {
    setEditingTarget(university)
    setFormData({
      name: university.name,
      country: university.country || '',
    })
    setError('')
    setShowForm(true)
  }

  const handleApprove = async (university: University) => {
    try {
      setActionLoading(true)
      setError('')
      const res = await csrfFetch(`/api/admin/universities/${university.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.ok) {
        toast.success('University approved and now visible in registration.')
        setApproveTarget(null)
        void fetchUniversities()
      } else {
        const data = await res.json()
        throw new Error(data.message || 'Failed to approve university')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve university'
      setError(message)
      toast.error(message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleSync = async () => {
    if (!syncTarget || !syncTargetUniversityId) {
      return
    }

    try {
      setActionLoading(true)
      setError('')
      const res = await csrfFetch(`/api/admin/universities/${syncTarget.id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUniversityId: syncTargetUniversityId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to sync university')
      }

      toast.success('University merged.')
      setSyncTarget(null)
      setSyncTargetUniversityId('')
      void fetchUniversities()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync university'
      setError(message)
      toast.error(message)
    } finally {
      setActionLoading(false)
    }
  }

  const executeDelete = async (id: string) => {
    try {
      setError('')
      const res = await csrfFetch(`/api/admin/universities/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({})) as { message?: string }

      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete university')
      }

      toast.success(data.message || 'University deleted successfully')
      void fetchUniversities()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete university'
      setError(message)
      toast.error(message)
    } finally {
      setDeleteTarget(null)
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingTarget(null)
    setFormData({ name: '', country: '' })
    setError('')
  }

  const listedUniversities = universities.filter((university) => university.isListed)

  if (loading) {
    return <PageLoader message="Loading universities..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Universities</h1>
          <p className="text-text-secondary">Manage participating universities</p>
        </div>
        <Button onClick={() => { if (showForm) resetForm(); else setShowForm(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          {showForm ? 'Close' : 'Add University'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingTarget ? 'Edit University' : 'Add University'}</CardTitle>
            <CardDescription>
              {editingTarget
                ? 'Update the university name or country before approving or syncing it.'
                : 'Add an institution before students or supervisors join under it.'}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <AlertBanner variant="error">
                  {error}
                </AlertBanner>
              )}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">University Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Cornell University"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    placeholder="e.g., USA"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex space-x-2">
                <Button type="submit" disabled={saving}>
                  {saving ? (editingTarget ? 'Saving...' : 'Adding...') : (editingTarget ? 'Save Changes' : 'Add University')}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      )}

      <DataTable
        data={universities}
        columns={[
          {
            key: 'name',
            header: 'University',
            sortable: true,
            render: (uni: University) => (
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary-soft p-2 text-primary">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{uni.name}</p>
                    {!uni.isListed ? <Badge variant="warning">Pending Review</Badge> : null}
                  </div>
                  <p className="text-xs text-text-muted">{uni.country || 'Country not set'}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'counts',
            header: 'Participation',
            render: (uni: University) => (
              <div className="flex flex-wrap gap-2">
                <Badge variant="info">{uni._count.users} users</Badge>
                <Badge variant="neutral">{uni._count.teams} teams</Badge>
              </div>
            ),
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (uni: University) => (
              <div className="flex flex-wrap items-start gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(uni)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                {!uni.isListed ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setApproveTarget(uni)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSyncTarget(uni)
                        setSyncTargetUniversityId('')
                      }}
                    >
                      Sync to Existing
                    </Button>
                  </>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(uni)}
                  disabled={!uni.canDelete}
                  className="text-error hover:bg-error-background hover:text-error"
                  title={uni.canDelete ? 'Delete university' : uni.deleteBlockedReason ?? 'This university cannot be deleted.'}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                {!uni.canDelete && uni.deleteBlockedReason ? (
                  <p className="max-w-xs text-xs text-text-muted">{uni.deleteBlockedReason}</p>
                ) : null}
              </div>
            ),
          },
        ]}
        searchKeys={['name']}
        searchPlaceholder="Search universities..."
        pageSize={10}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Delete University"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.name}? Only empty universities can be deleted. This permanently removes the university record.`
            : 'Only empty universities can be deleted. This permanently removes the university record.'
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => { if (deleteTarget) void executeDelete(deleteTarget.id) }}
      />

      <ConfirmDialog
        open={approveTarget !== null}
        onOpenChange={(open) => { if (!open) setApproveTarget(null) }}
        title="Approve University"
        description={
          approveTarget
            ? `Approve ${approveTarget.name}? It will become visible in the registration dropdown.`
            : 'Approve this pending university and make it visible in registration.'
        }
        confirmLabel="Approve"
        loading={actionLoading}
        onConfirm={() => { if (approveTarget) void handleApprove(approveTarget) }}
      />

      <ConfirmDialog
        open={syncTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSyncTarget(null)
            setSyncTargetUniversityId('')
          }
        }}
        title="Sync to Existing University"
        description={
          syncTarget
            ? `Move all linked users and teams from ${syncTarget.name} into a listed university.`
            : 'Move all linked users and teams into a listed university.'
        }
        confirmLabel="Sync University"
        loading={actionLoading}
        confirmDisabled={!syncTargetUniversityId}
        onConfirm={() => { void handleSync() }}
      >
        <div className="space-y-2">
          <Label htmlFor="syncTargetUniversity">Listed University</Label>
          <Select value={syncTargetUniversityId} onValueChange={setSyncTargetUniversityId}>
            <SelectTrigger id="syncTargetUniversity">
              <SelectValue placeholder="Select a listed university" />
            </SelectTrigger>
            <SelectContent>
              {listedUniversities
                .filter((university) => university.id !== syncTarget?.id)
                .map((university) => (
                  <SelectItem key={university.id} value={university.id}>
                    {university.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </ConfirmDialog>
    </div>
  )
}
