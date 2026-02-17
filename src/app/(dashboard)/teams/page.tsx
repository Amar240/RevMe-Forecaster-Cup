import { redirect } from 'next/navigation'
import { getSession } from '@/server/auth'
import { getTeamsForUser } from '@/features/teams/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Users, AlertTriangle, Check } from 'lucide-react'

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Active', className: 'bg-green-100 text-green-700' },
  PENDING_APPROVAL: { label: 'Pending Approval', className: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  DISQUALIFIED: { label: 'Disqualified', className: 'bg-red-100 text-red-700' },
}

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
          <h1 className="text-2xl font-bold text-gray-900">
            {user.role === 'ADMIN' ? 'All Teams' : 'My Teams'}
          </h1>
          <p className="text-gray-600">
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
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No teams yet</h3>
            <p className="text-gray-500 mb-4">
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
            <Card key={team.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <span>{team.name}</span>
                      {team.status === 'DISQUALIFIED' && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                          Disqualified
                        </span>
                      )}
                      {team.status !== 'DISQUALIFIED' && STATUS_BADGES[team.status] && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGES[team.status].className}`}>
                          {STATUS_BADGES[team.status].label}
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {team.displayId} | {team.university.name}
                    </CardDescription>
                  </div>
                  <Link href={`/teams/${team.id}`}>
                    <Button variant="outline" size="sm">Manage</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-8 text-sm">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span>{team.members.length}/5 members</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-gray-500" />
                    <span>{team._count.submissions} submissions</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-gray-500" />
                    <span>{team._count.warnings}/3 warnings</span>
                  </div>
                </div>
                {team.members.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 mb-2">Members:</p>
                    <div className="flex flex-wrap gap-2">
                      {team.members.map((member) => (
                        <span
                          key={member.id}
                          className={`text-xs px-2 py-1 rounded-full ${
                            member.isSubmitter
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {member.user.firstName} {member.user.lastName}
                          {member.isSubmitter && ' (Submitter)'}
                        </span>
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
