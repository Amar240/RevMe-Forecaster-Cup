import { redirect } from 'next/navigation'
import { getSession } from '@/server/auth'
import { getTeamsForUser } from '@/features/teams/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Users, AlertTriangle, Check } from 'lucide-react'
import { teamStatusMeta } from '@/lib/status-metadata'

export default async function TeamsPage() {
  const user = await getSession()
  if (!user) redirect('/login')
  if (user.role !== 'SUPERVISOR' && user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const { teams } = await getTeamsForUser()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {user.role === 'ADMIN' ? 'All Teams' : 'My Teams'}
          </h1>
          <p className="text-text-secondary">
            {user.role === 'SUPERVISOR' && `${teams.length} of 10 teams created`}
          </p>
        </div>
        {user.role === 'SUPERVISOR' && teams.length < 10 && (
          <Link href="/teams/new">
            <Button>Create Team</Button>
          </Link>
        )}
      </div>

      {teams.length === 0 ? (
        <Card variant="default">
          <CardContent className="py-12 text-center">
            <Users className="mb-4 h-12 w-12 text-text-muted mx-auto" />
            <h3 className="mb-2 text-lg font-medium text-foreground">No teams yet</h3>
            <p className="mb-4 text-text-secondary">
              Create your first team to start managing students.
            </p>
            <Link href="/teams/new">
              <Button>Create Team</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {teams.map((team) => (
            <Card key={team.id} variant="default">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span>{team.name}</span>
                      {teamStatusMeta[team.status as keyof typeof teamStatusMeta] && (
                        <Badge variant={teamStatusMeta[team.status as keyof typeof teamStatusMeta].tone}>
                          {teamStatusMeta[team.status as keyof typeof teamStatusMeta].label}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {team.displayId} | {team.university.name}
                    </CardDescription>
                  </div>
                  <Link href={user.role === 'ADMIN' ? `/admin/teams/${team.id}` : `/teams/${team.id}`}>
                    <Button variant="outline" size="sm">Manage</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-8 text-sm text-text-secondary">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-text-muted" />
                    <span>{team.members.length}/5 members</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-text-muted" />
                    <span>{team._count.submissions} submissions</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-text-muted" />
                    <span>{team._count.warnings}/3 warnings</span>
                  </div>
                </div>
                {team.members.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm text-text-muted">Members:</p>
                    <div className="flex flex-wrap gap-2">
                      {team.members.map((member) => (
                        <Badge
                          key={member.id}
                          variant={member.isSubmitter ? 'info' : 'neutral'}
                          className="px-2 py-1 font-medium"
                        >
                          {member.user.firstName} {member.user.lastName}
                          {member.isSubmitter && ' (Submitter)'}
                        </Badge>
                      ))}
                    </div>
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
