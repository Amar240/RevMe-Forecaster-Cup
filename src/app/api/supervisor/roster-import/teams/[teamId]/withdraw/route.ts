import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { jsonError, jsonOk, parseJson, requireUserOrResponse } from '@/server/http'
import { withdrawSupervisorImportedTeam } from '@/server/roster-import'

const schema = z.object({ reason: z.string().trim().min(1).max(500).optional() })

export async function POST(request: NextRequest, { params }: { params: { teamId: string } }) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response
    const body = await parseJson(request, schema)
    return jsonOk(await withdrawSupervisorImportedTeam(user!, params.teamId, body.reason))
  } catch (error) {
    return jsonError(error, 'Failed to withdraw imported team')
  }
}
