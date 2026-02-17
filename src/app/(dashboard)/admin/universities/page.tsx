'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, Plus, Trash2 } from 'lucide-react'

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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this university?')) return

    try {
      await csrfFetch(`/api/admin/universities/${id}`, { method: 'DELETE' })
      fetchUniversities()
    } catch {
      setError('Failed to delete university')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
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

      {universities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Universities</h3>
            <p className="text-gray-500">Add universities to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Universities ({universities.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-3 pr-4">Name</th>
                    <th className="pb-3 pr-4">Country</th>
                    <th className="pb-3 pr-4 text-right">Users</th>
                    <th className="pb-3 pr-4 text-right">Teams</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {universities.map((uni) => (
                    <tr key={uni.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{uni.name}</td>
                      <td className="py-3 pr-4 text-gray-600">{uni.country || '-'}</td>
                      <td className="py-3 pr-4 text-right">{uni._count.users}</td>
                      <td className="py-3 pr-4 text-right">{uni._count.teams}</td>
                      <td className="py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(uni.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

