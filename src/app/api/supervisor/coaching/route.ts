import { NextRequest } from 'next/server'
import { requireUserOrResponse, jsonError, jsonOk, ApiError } from '@/server/http'
import { getSupervisorCoaching } from '@/server/supervisor-coaching'

export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  try { const { user, response } = await requireUserOrResponse(); if (response) return response; if (user!.role !== 'SUPERVISOR') throw new ApiError('Supervisor access required', 403, 'FORBIDDEN'); return jsonOk({ coaching: await getSupervisorCoaching(user!.id, request.nextUrl.searchParams.get('roundId')) }) }
  catch (error) { return jsonError(error, 'Failed to load coaching view') }
}
