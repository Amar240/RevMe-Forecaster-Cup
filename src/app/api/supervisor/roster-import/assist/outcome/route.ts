import { NextRequest } from 'next/server'
import { requireUserOrResponse, jsonOk, jsonError, parseJson } from '@/server/http'
import { assistOutcomeSchema } from '@/lib/team-import/assist'
import { recordRosterAssistOutcome } from '@/server/roster-import-assist'
import { getSupervisorImportSeason } from '@/server/roster-import'
import { prisma } from '@/lib/db'
import { requireImportAssistEnabled } from '../route-utils'

export async function POST(request: NextRequest) {
  try {
    requireImportAssistEnabled()
    const { user, response } = await requireUserOrResponse(); if (response) return response
    const body = await parseJson(request, assistOutcomeSchema)
    const seasonId = user!.role === 'SUPERVISOR' ? (await getSupervisorImportSeason(user!)).id : (await prisma.importBatch.findUnique({ where: { id: body.batchId }, select: { seasonId: true } }))?.seasonId ?? ''
    return jsonOk(await recordRosterAssistOutcome({ actor: user!, seasonId, ...body }))
  } catch (error) { return jsonError(error, 'Failed to record import assist outcome') }
}
