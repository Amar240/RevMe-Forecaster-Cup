'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, Plus, Trash2 } from 'lucide-react'
import { PageLoader } from '@/components/ui/page-loader'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable } from '@/components/ui/data-table'
import { toast } from 'sonner'

interface University {
  id: string
  name: string
  country: string | null
  _count: { users: number; teams: number }
}

export default function AdminUniversitiesPage() {
  const [universities, setUniversities] = useState<University[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', country: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

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
      const res = await csrfFetch('/api/admin/universities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        setFormData({ name: '', country: '' })
        setShowForm(false)
        fetchUniversities()
      } else {
        const data = await res.json()
        setError(data.message || 'Failed to add university')
      }
    } catch {
      setError('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const executeDelete = async (id: string) => {
    try {
      await csrfFetch(`/api/admin/universities/${id}`, { method: 'DELETE' })
      fetchUniversities()
    } catch {
      setError('Failed to delete university')
    } finally {
      setDeleteTarget(null)
    }
  }

  if (loading) {
    return <PageLoader message="Loading universities…" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Universities</h1>
          <p className="text-gray-600">Manage participating universities</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Add University
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add University</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-2 rounded-md text-sm">
                  {error}
                </div>
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
                  {saving ? 'Adding...' : 'Add University'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
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
          { key: 'name', header: 'Name', sortable: true },
          {
            key: 'actions',
            header: 'Actions',
            render: (uni: University) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteTarget(uni.id)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
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
        description="Are you sure you want to delete this university?"
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => { if (deleteTarget) executeDelete(deleteTarget) }}
      />
    </div>
  )
}

