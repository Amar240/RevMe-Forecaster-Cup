import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'
import { logAuditAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const now = new Date()

    const closedRounds = await prisma.round.findMany({
      where: { closesAt: { lt: now } },
      select: { id: true, number: true },
    })

    if (closedRounds.length === 0) {
      return jsonOk({ message: 'No closed rounds to check', warningsCreated: 0, teamsDisqualified: 0 })
    }

    const activeTeams = await prisma.team.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    })

    if (activeTeams.length === 0) {
      return jsonOk({ message: 'No active teams', warningsCreated: 0, teamsDisqualified: 0 })
    }

    const roundIds = closedRounds.map((r) => r.id)
    const teamIds = activeTeams.map((t) => t.id)

    const [existingSubmissions, existingWarnings] = await Promise.all([
      prisma.submission.findMany({
        where: { roundId: { in: roundIds }, teamId: { in: teamIds } },
        select: { teamId: true, roundId: true },
      }),
      prisma.warning.findMany({
        where: {
          roundId: { in: roundIds },
          teamId: { in: teamIds },
          type: 'MISSED_SUBMISSION',
        },
        select: { teamId: true, roundId: true },
      }),
    ])

    const submissionSet = new Set(existingSubmissions.map((s) => `${s.teamId}:${s.roundId}`))
    const warningSet = new Set(existingWarnings.map((w) => `${w.teamId}:${w.roundId}`))

    const roundNumberMap = new Map(closedRounds.map((r) => [r.id, r.number]))

    const warningsToCreate: { teamId: string; roundId: string; type: 'MISSED_SUBMISSION'; message: string }[] = []

    for (const teamId of teamIds) {
      for (const roundId of roundIds) {
        const key = `${teamId}:${roundId}`
        if (!submissionSet.has(key) && !warningSet.has(key)) {
          warningsToCreate.push({
            teamId,
            roundId,
            type: 'MISSED_SUBMISSION',
            message: `Missed submission for Round ${roundNumberMap.get(roundId)}`,
          })
        }
      }
    }

    if (warningsToCreate.length > 0) {
      await prisma.warning.createMany({ data: warningsToCreate })
    }

    const teamsToDisqualify = await prisma.team.findMany({
      where: {
        status: 'ACTIVE',
        warnings: { some: {} },
      },
      include: { _count: { select: { warnings: true } } },
    })

    let disqualified = 0
    const disqualifyOps = teamsToDisqualify
      .filter((t) => t._count.warnings >= 3)
      .map((team) =>
        prisma.team.update({
          where: { id: team.id },
          data: {
            status: 'DISQUALIFIED',
            disqualifiedAt: new Date(),
            disqualifiedReason: 'Three missed submissions',
          },
        })
      )

    if (disqualifyOps.length > 0) {
      await prisma.$transaction(disqualifyOps)
      disqualified = disqualifyOps.length
    }

    await logAuditAction(user!.id, 'RUN_WARNINGS', 'System', null, {
      warningsCreated: warningsToCreate.length,
      teamsDisqualified: disqualified,
    })

    return jsonOk({
      message: 'Warnings check complete',
      warningsCreated: warningsToCreate.length,
      teamsDisqualified: disqualified,
    })
  } catch (error) {
    return jsonError(error, 'Warnings check failed')
  }
}
