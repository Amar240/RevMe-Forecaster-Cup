import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { logAuditAction } from '@/lib/audit'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'

export const dynamic = 'force-dynamic'

// ─── GET /api/admin/teams/copy-from-season ─────────────────────────────────
// Returns the list of completed seasons that have at least one ACTIVE team,
// plus a "preview" team count per season.  Used to populate the modal.
export async function GET() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const seasons = await prisma.season.findMany({
      where: { status: 'COMPLETED' },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        _count: {
          select: {
            teams: {
              where: { status: 'ACTIVE' },
            },
          },
        },
      },
      orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
    })

    // Only return seasons that actually have teams
    const withTeams = seasons
      .filter((s) => s._count.teams > 0)
      .map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        startDate: s.startDate,
        endDate: s.endDate,
        teamCount: s._count.teams,
      }))

    return jsonOk({ seasons: withTeams })
  } catch (error) {
    return jsonError(error, 'Failed to load copy-from-season options')
  }
}

// ─── POST /api/admin/teams/copy-from-season ────────────────────────────────
// Body: { sourceSeasonId, targetSeasonId, copyMembers }
// Copies ACTIVE teams from the source season into the target season.
// Carries: name, externalTeamId, universityId, supervisorId.
// Does NOT copy: members, submissions, scores, warnings.
export async function POST(request: Request) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const body = await request.json() as {
      sourceSeasonId: string
      targetSeasonId: string
      copyMembers: boolean
    }

    const { sourceSeasonId, targetSeasonId, copyMembers } = body

    if (!sourceSeasonId || !targetSeasonId) {
      throw new ApiError('sourceSeasonId and targetSeasonId are required', 400, 'INVALID_INPUT')
    }

    if (sourceSeasonId === targetSeasonId) {
      throw new ApiError('Source and target season must be different', 400, 'INVALID_INPUT')
    }

    if (copyMembers) {
      throw new ApiError('Copying team members is unavailable in this first safe version', 422, 'INVALID_INPUT')
    }

    // Verify target season exists and is not completed
    const targetSeason = await prisma.season.findUnique({
      where: { id: targetSeasonId },
      select: { id: true, name: true, status: true },
    })

    if (!targetSeason) {
      throw new ApiError('Target season not found', 404, 'NOT_FOUND')
    }

    if (targetSeason.status === 'COMPLETED') {
      throw new ApiError('Cannot import teams into a completed season', 422, 'INVALID_INPUT')
    }

    const latestCompletedSeason = await prisma.season.findFirst({
      where: {
        status: 'COMPLETED',
        teams: {
          some: {
            status: 'ACTIVE',
          },
        },
      },
      select: { id: true, name: true },
      orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
    })

    if (!latestCompletedSeason) {
      throw new ApiError('No completed season with copyable teams was found', 422, 'INVALID_INPUT')
    }

    if (sourceSeasonId !== latestCompletedSeason.id) {
      throw new ApiError('Only the most recent completed season can be copied in this version', 422, 'INVALID_INPUT')
    }

    // Load source teams
    const sourceTeams = await prisma.team.findMany({
      where: {
        seasonId: latestCompletedSeason.id,
        status: 'ACTIVE',
      },
      select: {
        name: true,
        externalTeamId: true,
        universityId: true,
        supervisorId: true,
      },
    })

    if (sourceTeams.length === 0) {
      throw new ApiError('No active teams found in the source season', 422, 'INVALID_INPUT')
    }

    // Check for externalTeamId collisions in the target season to avoid the unique constraint
    // @@unique([seasonId, externalTeamId])
    const existingExternalIds = new Set(
      (
        await prisma.team.findMany({
          where: { seasonId: targetSeasonId, externalTeamId: { not: null } },
          select: { externalTeamId: true },
        })
      ).map((t) => t.externalTeamId)
    )

    const now = new Date()
    const actorId = user!.id

    let teamsCreated = 0
    let teamsSkipped = 0
    const membersLinked = 0

    for (const source of sourceTeams) {
      // Skip if a team with the same externalTeamId already exists in the target season
      if (source.externalTeamId && existingExternalIds.has(source.externalTeamId)) {
        teamsSkipped += 1
        continue
      }

      try {
        // Generate a unique displayId (same logic as bulk import)
        let displayId: string | null = null
        for (let attempt = 0; attempt < 5; attempt++) {
          const candidate = `T-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`
          const clash = await prisma.team.findUnique({
            where: { displayId: candidate },
            select: { id: true },
          })
          if (!clash) {
            displayId = candidate
            break
          }
        }

        if (!displayId) {
          throw new Error('Could not generate a unique team identifier')
        }

        await prisma.team.create({
          data: {
            name: source.name,
            displayId,
            externalTeamId: source.externalTeamId ?? null,
            status: 'ACTIVE',
            approvedAt: now,
            approvedById: actorId,
            supervisorId: source.supervisorId ?? null,
            universityId: source.universityId,
            seasonId: targetSeasonId,
          },
        })

        teamsCreated += 1
      } catch {
        teamsSkipped += 1
      }
    }

    await logAuditAction(
      actorId,
      'TEAM_COPY_FROM_SEASON',
      'Team',
      'bulk-copy',
      {
        sourceSeasonId,
        sourceSeasonName: latestCompletedSeason.name,
        targetSeasonId,
        targetSeasonName: targetSeason.name,
        copyMembers: false,
        teamsConsidered: sourceTeams.length,
        teamsCreated,
        teamsSkipped,
        membersLinked,
      }
    )

    return jsonOk({
      sourceSeasonName: latestCompletedSeason.name,
      targetSeasonName: targetSeason.name,
      teamsCreated,
      teamsSkipped,
      membersLinked,
    })
  } catch (error) {
    return jsonError(error, 'Failed to copy teams from season')
  }
}
