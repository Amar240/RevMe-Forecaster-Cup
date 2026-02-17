import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

function getRoundStatus(opensAt: Date, closesAt: Date): string {
  const now = new Date()
  if (now < opensAt) return 'Upcoming'
  if (now > closesAt) return 'Closed'
  const hoursLeft = (closesAt.getTime() - now.getTime()) / (1000 * 60 * 60)
  if (hoursLeft <= 24) return 'Closing Soon'
  return 'Open'
}

export async function GET() {
  try {
    const user = await getSession()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const activeSeason = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
      include: {
        rounds: {
          orderBy: { number: 'asc' },
          include: {
            _count: { select: { submissions: true, actuals: true } },
          },
        },
        markets: { where: { isActive: true }, include: { market: true } },
      },
    })

    const now = new Date()
    const currentRound = activeSeason?.rounds.find(
      (r) => {
        const isTimeOpen = new Date(r.closesAt) > now && new Date(r.opensAt) <= now
        const hasStatus = 'status' in r
        const isStatusOpen = !hasStatus || r.status === 'OPEN'
        return isTimeOpen && isStatusOpen
      }
    )

    const [totalTeams, activeTeams, disqualifiedTeams, totalUsers, totalSubmissions, totalWarnings] = await Promise.all([
      prisma.team.count(),
      prisma.team.count({ where: { status: 'ACTIVE' } }),
      prisma.team.count({ where: { status: 'DISQUALIFIED' } }),
      prisma.user.count(),
      prisma.submission.count(),
      prisma.warning.count(),
    ])

    let currentRoundSubmissions = 0
    let submittedTeamIds: string[] = []
    if (currentRound) {
      const submissions = await prisma.submission.findMany({
        where: { roundId: currentRound.id },
        select: { teamId: true },
        distinct: ['teamId'],
      })
      submittedTeamIds = submissions.map(s => s.teamId)
      currentRoundSubmissions = submittedTeamIds.length
    }

    const scoredSubmissions = await prisma.predictionError.count()

    const rounds = (activeSeason?.rounds || []).map((round) => {
      const hasActuals = round._count.actuals > 0
      const isScored = round._count.submissions > 0 && hasActuals

      return {
        id: round.id,
        number: round.number,
        opensAt: round.opensAt.toISOString(),
        closesAt: round.closesAt.toISOString(),
        status: getRoundStatus(new Date(round.opensAt), new Date(round.closesAt)),
        submissionCount: round._count.submissions,
        hasActuals,
        isScored,
      }
    })

    return NextResponse.json({
      activeSeason: activeSeason ? {
        id: activeSeason.id,
        name: activeSeason.name,
        status: activeSeason.status,
      } : null,
      currentRound: currentRound ? {
        id: currentRound.id,
        number: currentRound.number,
        opensAt: currentRound.opensAt.toISOString(),
        closesAt: currentRound.closesAt.toISOString(),
        status: getRoundStatus(new Date(currentRound.opensAt), new Date(currentRound.closesAt)),
      } : null,
      stats: {
        totalTeams,
        activeTeams,
        disqualifiedTeams,
        totalUsers,
        totalSubmissions,
        currentRoundSubmissions,
        totalWarnings,
        teamsWithActuals: rounds.filter(r => r.hasActuals).length,
        scoredSubmissions,
      },
      submissionProgress: {
        submitted: currentRoundSubmissions,
        pending: activeTeams - currentRoundSubmissions,
        total: activeTeams,
      },
      rounds,
    })
  } catch (error) {
    console.error('Command center error:', error)
    return NextResponse.json({ message: 'Failed to load command center' }, { status: 500 })
  }
}
