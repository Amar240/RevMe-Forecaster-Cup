import { prisma } from '@/lib/db'
import { buildRosterTemplate } from '@/lib/team-import/template'
import { ApiError, jsonError, requireAdminOrResponse } from '@/server/http'
import { countSupervisorTeamsInSeason } from '@/server/team-membership'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response
    if (user!.role !== 'ADMIN') throw new ApiError('Full administrator access is required', 403, 'FORBIDDEN')
    const url = new URL(request.url)
    const seasonId = url.searchParams.get('seasonId')?.trim()
    const universityId = url.searchParams.get('universityId')?.trim()
    const supervisorId = url.searchParams.get('supervisorId')?.trim()
    if (!seasonId || !universityId || !supervisorId) throw new ApiError('Select a season, university, and supervisor first', 400, 'INVALID_INPUT')
    const [season, university, supervisor] = await Promise.all([
      prisma.season.findFirst({ where: { id: seasonId, status: { not: 'COMPLETED' } }, select: { id: true, name: true } }),
      prisma.university.findFirst({ where: { id: universityId, isListed: true }, select: { id: true, name: true } }),
      prisma.user.findFirst({ where: { id: supervisorId, role: 'SUPERVISOR', isActive: true, universityId }, select: { id: true, firstName: true, lastName: true, email: true } }),
    ])
    if (!season) throw new ApiError('The selected season is not available for import', 422, 'INVALID_INPUT')
    if (!university) throw new ApiError('The selected university is not available', 422, 'INVALID_INPUT')
    if (!supervisor) throw new ApiError('Select an active supervisor from this university', 422, 'INVALID_INPUT')
    if (await countSupervisorTeamsInSeason({ supervisorId, seasonId }) >= 10) throw new ApiError('This supervisor already manages the maximum of 10 teams in this season', 422, 'INVALID_INPUT')
    const workbook = buildRosterTemplate({ mode: 'admin', seasonId, seasonName: season.name, universityId, universityName: university.name, supervisorId, instructorName: `${supervisor.firstName} ${supervisor.lastName}`.trim(), instructorEmail: supervisor.email })
    return new Response(new Uint8Array(workbook), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="revme-${season.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-roster.xlsx"`, 'Cache-Control': 'private, no-store' } })
  } catch (error) { return jsonError(error, 'Failed to generate roster template') }
}
