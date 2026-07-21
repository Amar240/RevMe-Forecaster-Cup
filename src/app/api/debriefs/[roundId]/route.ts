import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params
  const url = new URL(request.url)
  url.pathname = `/api/debrief/${roundId}`
  return NextResponse.redirect(url, 308)
}
