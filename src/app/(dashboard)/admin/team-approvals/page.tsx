'use client'

import { clientLogger } from '@/lib/client-logger'
import { approveTeam, getPendingTeams, rejectTeam } from '@/features/teams/admin-api'
import type { PendingTeam } from '@/features/teams/types'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Loader2, Users, CheckCircle, XCircle, Clock, Building2, User } from 'lucide-react'
import { toast } from 'sonner'

export default function TeamApprovalsPage() {
  const [teams, setTeams] = useState<PendingTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectFor, setShowRejectFor] = useState<string | null>(null)

  useEffect(() => {
    fetchTeams()
  }, [])

  const fetchTeams = async () => {
    try {
      const data = await getPendingTeams()
      setTeams(data.teams || [])
    } catch (err) {
      clientLogger.error('Failed to fetch pending teams:', err)
      toast.error('Failed to load pending teams')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (teamId: string, action: string, reason?: string) => {
    setProcessing(teamId)
    try {
      if (action === 'approve') {
        await approveTeam(teamId)
      } else if (action === 'reject') {
        await rejectTeam(teamId, reason)
      }
      fetchTeams()
      setShowRejectFor(null)
      setRejectReason('')
    } catch (err) {
      clientLogger.error('Failed to process team:', err)
      toast.error('Failed to process team request')
    } finally {
      setProcessing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Approvals</h1>
          <p className="text-text-secondary">Review and approve teams for competition participation</p>
        </div>
        <Badge variant="warning" className="px-3 py-1 text-sm">
          {teams.length} Pending
        </Badge>
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="mx-auto mb-4 h-12 w-12 text-success" />
            <h3 className="mb-2 text-lg font-medium text-foreground">All Caught Up!</h3>
            <p className="text-text-secondary">No teams pending approval</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {teams.map((team) => (
            <Card key={team.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    {team.name}
                  </div>
                  <span className="text-sm font-normal text-text-muted">{team.displayId}</span>
                </CardTitle>
                <CardDescription className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" /> {team.university.name}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" /> {team.supervisor.firstName} {team.supervisor.lastName}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-text-secondary">Team Members ({team.members.length}/5)</p>
                  <div className="flex flex-wrap gap-2">
                    {team.members.map((m, i) => (
                      <Badge key={i} variant="neutral" className="px-2 py-1 text-sm font-medium">
                        {m.user.firstName} {m.user.lastName}
                      </Badge>
                    ))}
                    {team.members.length === 0 && (
                      <span className="text-sm text-text-muted">No members yet</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <Clock className="h-4 w-4 text-text-muted" />
                  Created {new Date(team.createdAt).toLocaleDateString()}
                  {team.season && ` - ${team.season.name}`}
                </div>

                {showRejectFor === team.id ? (
                  <div className="space-y-3 rounded-lg border border-error/20 bg-error-background/60 p-4">
                    <p className="font-medium text-foreground">Rejection Reason</p>
                    <Input
                      placeholder="Enter reason for rejection..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={() => handleAction(team.id, 'reject', rejectReason)}
                        disabled={processing === team.id}
                      >
                        {processing === team.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Confirm Reject'
                        )}
                      </Button>
                      <Button variant="outline" onClick={() => setShowRejectFor(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleAction(team.id, 'approve')}
                      disabled={processing === team.id}
                    >
                      {processing === team.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-1" /> Approve
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectFor(team.id)}
                      className="border-error/20 bg-error-background/60 text-error hover:bg-error-background"
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
