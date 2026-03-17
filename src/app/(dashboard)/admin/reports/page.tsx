'use client'

import { useEffect, useState } from 'react'
import { Download, Trophy, Users } from 'lucide-react'
import { toast } from 'sonner'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageLoader } from '@/components/ui/page-loader'

interface Supervisor {
  id: string
  firstName: string
  lastName: string
  email: string
  teamCount: number
}

export default function AdminReportsPage() {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    async function fetchSupervisors() {
      try {
        const res = await csrfFetch('/api/admin/users?role=SUPERVISOR')
        if (res.ok) {
          const data = await res.json()
          setSupervisors(
            data.users?.map((user: any) => ({
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              teamCount: user._count?.supervisedTeams || 0,
            })) || []
          )
        }
      } catch (error) {
        clientLogger.error('Failed to fetch supervisors:', error)
        toast.error('Failed to load supervisors')
      } finally {
        setLoading(false)
      }
    }

    void fetchSupervisors()
  }, [])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const params = new URLSearchParams()
      if (selectedSupervisor !== 'all') {
        params.set('supervisorId', selectedSupervisor)
      }

      const res = await csrfFetch(`/api/admin/reports/instructor?${params}`)
      if (!res.ok) {
        toast.error('Failed to generate report')
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download =
        res.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'report.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Report downloaded successfully')
    } catch (error) {
      clientLogger.error('Failed to download report:', error)
      toast.error('Failed to download report')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) return <PageLoader message="Loading reports..." />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
        <p className="mt-1 text-text-secondary">Generate and download competition reports</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Instructor Report
            </CardTitle>
            <CardDescription>
              Generate a per-supervisor report with team submissions, scores, warnings, and rankings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">Supervisor</label>
              <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supervisor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Supervisors</SelectItem>
                  {supervisors.map((supervisor) => (
                    <SelectItem key={supervisor.id} value={supervisor.id}>
                      {supervisor.firstName} {supervisor.lastName} ({supervisor.email}) - {supervisor.teamCount} teams
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleDownload} disabled={downloading} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              {downloading ? 'Generating...' : 'Download CSV Report'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-accent" />
              Leaderboard Export
            </CardTitle>
            <CardDescription>Export the current leaderboard rankings as CSV</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-text-secondary">
              Downloads the complete leaderboard with team scores, MAPE, and rankings for the active season.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                window.location.href = '/api/admin/submissions/export'
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Leaderboard CSV
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
