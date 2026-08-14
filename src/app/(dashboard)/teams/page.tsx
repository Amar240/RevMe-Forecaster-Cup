import { redirect } from 'next/navigation'
import { getSession } from '@/server/auth'
import { getTeamsForUser } from '@/features/teams/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Users, AlertTriangle, Check } from 'lucide-react'
import { teamStatusMeta } from '@/lib/status-metadata'
import { getCurrentOperationalSeason } from '@/server/season'

export default async function TeamsPage() {
  const user = await getSession()
  if (!user) redirect('/login')
  if (user.role !== 'SUPERVISOR' && user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const { teams } = await getTeamsForUser()
  const operationalSeason = await getCurrentOperationalSeason({ select: { id: true } })
  const hasOperationalSeason = Boolean(operationalSeason)

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.role === 'ADMIN' ? 'All Teams' : 'My Teams'}
        description={user.role === 'SUPERVISOR' ? `${teams.length} of 10 teams created` : undefined}
        actions={
          user.role === 'SUPERVISOR' && hasOperationalSeason && teams.length < 10 ? (
            <Link href="/teams/new">
              <Button>Create Team</Button>
            </Link>
          ) : undefined
        }
      />

      {teams.length === 0 ? (
        <Card variant="default">
          <CardContent className="p-0">
            <EmptyState
              icon={<Users className="h-7 w-7" />}
              title="No teams yet"
              description={user.role === 'SUPERVISOR' && !hasOperationalSeason
                ? 'An admin needs to create, activate, or resume a season before you can create teams.'
                : 'Create your first team to start managing students.'}
              action={!(user.role === 'SUPERVISOR' && !hasOperationalSeason) ? (
                <Link href="/teams/new">
                  <Button>Create Team</Button>
                </Link>
              ) : undefined}
            />
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
