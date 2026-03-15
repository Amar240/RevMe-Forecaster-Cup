'use client'

import { csrfFetch } from '@/lib/csrf'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function NewTeamPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await csrfFetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Failed to create team')
        return
      }

      router.push(`/teams/${data.team.id}`)
      router.refresh()
    } catch {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <Card variant="default">
        <CardHeader>
          <CardTitle>Create New Team</CardTitle>
          <CardDescription>
            Create a team and add up to 5 students. Teams require admin approval before they can submit.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <AlertBanner variant="error">
                {error}
              </AlertBanner>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Team Name</Label>
              <Input
                id="name"
                placeholder="Enter team name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating...' : 'Create Team'}
            </Button>
            <div className="rounded-lg border border-border bg-surface-secondary px-4 py-3 text-xs leading-5 text-text-secondary">
              After creation, your team will show as Pending Approval until an admin activates it.
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
