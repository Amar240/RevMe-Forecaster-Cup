import { NextRequest } from 'next/server'
import { requireUserOrResponse, jsonOk, parseJson } from '@/server/http'
import { assistOutcomeSchema } from '@/lib/team-import/assist'
import { recordRosterAssistOutcome } from '@/server/roster-import-assist'
import { prisma } from '@/lib/db'
import { importAssistJsonError, importAssistSeason, requireImportAssistEnabled } from '../route-utils'

export async function POST(request: NextRequest) {
  try {
    requireImportAssistEnabled()
    const { user, response } = await requireUserOrResponse(); if (response) return response
    const body = await parseJson(request, assistOutcomeSchema)
    const batchSeasonId = (await prisma.importBatch.findUnique({ where: { id: body.batchId }, select: { seasonId: true } }))?.seasonId ?? ''
    const seasonId = await importAssistSeason(user!, batchSeasonId)
    return jsonOk(await recordRosterAssistOutcome({ actor: user!, seasonId, ...body }))
  } catch (error) { return importAssistJsonError(error, 'Failed to record import assist outcome') }
}
