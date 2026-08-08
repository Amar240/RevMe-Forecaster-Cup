import { requireUserOrResponse, jsonError } from '@/server/http'
import { getSupervisorImportSeason } from '@/server/roster-import'
import { buildRosterTemplate } from '@/lib/team-import/template'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response
    const season = await getSupervisorImportSeason(user!)
    const university = await prisma.university.findUnique({ where: { id: user!.universityId! }, select: { name: true } })
    const workbook = buildRosterTemplate({ mode: 'supervisor', seasonId: season.id, seasonName: season.name, universityId: user!.universityId!, universityName: university?.name ?? '', supervisorId: user!.id, instructorName: `${user!.firstName} ${user!.lastName}`.trim(), instructorEmail: user!.email })
    return new Response(new Uint8Array(workbook), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="revme-roster-template.xlsx"', 'Cache-Control': 'private, no-store' } })
  } catch (error) { return jsonError(error, 'Failed to generate roster template') }
}
