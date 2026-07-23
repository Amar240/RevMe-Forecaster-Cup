import { NextResponse } from 'next/server'
import { GET as getCurrentSubmission } from '../current/route'

export const dynamic = 'force-dynamic'

export async function GET() {
  const response = await getCurrentSubmission()
  const body = await response.json()
  if (!response.ok) return NextResponse.json(body, { status: response.status })
  return NextResponse.json({
    context: body.context ?? null,
    currentRound: body.currentRound ?? null,
    markets: body.markets ?? [],
    evidenceByMarket: body.evidenceByMarket ?? {},
  })
}
