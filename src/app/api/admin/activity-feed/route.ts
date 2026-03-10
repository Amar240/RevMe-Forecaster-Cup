import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours

    const [recentSubmissions, recentWarnings, recentTickets, recentAuditLogs, recentScoringRuns] = await Promise.all([
      prisma.submission.findMany({
        where: { submittedAt: { gte: since } },
        select: {
          id: true, submittedAt: true,
          team: { select: { name: true } },
          round: { select: { number: true } },
        },
        orderBy: { submittedAt: 'desc' },
        take: 10,
      }),
      prisma.warning.findMany({
        where: { createdAt: { gte: since } },
        select: {
          id: true, createdAt: true, type: true,
          team: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.supportTicket.findMany({
        where: { createdAt: { gte: since } },
        select: {
          id: true, createdAt: true, subject: true,
          createdBy: { select: { email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.auditLog.findMany({
        where: { createdAt: { gte: since } },
        select: { id: true, action: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.scoringRun.findMany({
        where: { finishedAt: { gte: since } },
        select: { id: true, status: true, finishedAt: true, errorsUpserted: true },
        orderBy: { finishedAt: 'desc' },
        take: 3,
      }),
    ])

    const events = [
      ...recentSubmissions.map(s => ({
        id: `sub-${s.id}`,
        type: 'submission' as const,
        message: `${s.team.name} submitted Round ${s.round.number}`,
        timestamp: s.submittedAt?.toISOString() || new Date().toISOString(),
      })),
      ...recentWarnings.map(w => ({
        id: `warn-${w.id}`,
        type: 'warning' as const,
        message: `${w.team.name} received ${w.type.replace('_', ' ').toLowerCase()} warning`,
        timestamp: w.createdAt.toISOString(),
      })),
      ...recentTickets.map(t => ({
        id: `ticket-${t.id}`,
        type: 'ticket' as const,
        message: `New support ticket: "${t.subject}" from ${t.createdBy.email}`,
        timestamp: t.createdAt.toISOString(),
      })),
      ...recentAuditLogs.map(a => ({
        id: `audit-${a.id}`,
        type: 'audit' as const,
        message: `Admin action: ${a.action.replace(/_/g, ' ').toLowerCase()}`,
        timestamp: a.createdAt.toISOString(),
      })),
      ...recentScoringRuns.map(s => ({
        id: `score-${s.id}`,
        type: 'scoring' as const,
        message: `Scoring ${s.status.toLowerCase()} — ${s.errorsUpserted} errors calculated`,
        timestamp: s.finishedAt?.toISOString() || new Date().toISOString(),
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
     .slice(0, 20)

    return jsonOk({ events })
  } catch (error) {
    return jsonError(error, 'Failed to load activity feed')
  }
}
