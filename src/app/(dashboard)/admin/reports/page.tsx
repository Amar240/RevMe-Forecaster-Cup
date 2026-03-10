'use client'

import { useState, useEffect } from 'react'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Download, FileText, Users, Trophy } from 'lucide-react'
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
          setSupervisors(data.users?.map((u: any) => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            teamCount: u._count?.supervisedTeams || 0,
          })) || [])
        }
      } catch (error) {
        clientLogger.error('Failed to fetch supervisors:', error)
        toast.error('Failed to load supervisors')
      } finally {
        setLoading(false)
      }
    }
    fetchSupervisors()
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
      a.download = res.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'report.csv'
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
        <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
        <p className="text-gray-500 mt-1">Generate and download competition reports</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Instructor Report
            </CardTitle>
            <CardDescription>
              Generate a per-supervisor report with team submissions, scores, warnings, and rankings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Supervisor</label>
              <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supervisor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Supervisors</SelectItem>
                  {supervisors.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.email}) — {s.teamCount} teams
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleDownload} disabled={downloading} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              {downloading ? 'Generating...' : 'Download CSV Report'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-600" />
              Leaderboard Export
            </CardTitle>
            <CardDescription>
              Export the current leaderboard rankings as CSV
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              Downloads the complete leaderboard with team scores, MAE, and rankings for the active season.
            </p>
            <Button variant="outline" className="w-full" onClick={() => {
              window.location.href = '/api/admin/submissions/export'
            }}>
              <Download className="h-4 w-4 mr-2" />
              Export Leaderboard CSV
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
