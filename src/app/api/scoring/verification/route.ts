import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import type { Role } from '@prisma/client'
import { getSession } from '@/server/auth'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const teamId = searchParams.get('teamId')
  const roundId = searchParams.get('roundId')

  const activeSeason = await prisma.season.findFirst({
    where: { status: 'ACTIVE' },
    include: {
      rounds: { orderBy: { number: 'asc' } },
      markets: {
        where: { isActive: true },
        include: { market: true },
      },
    },
  })

  if (!activeSeason) {
    return NextResponse.json({ message: 'No active season' }, { status: 404 })
  }

  let targetTeamId = teamId
  let allowedTeamIds: string[] = []

  const adminRoles: Role[] = ['ADMIN', 'SUB_ADMIN']
  const supervisorRoles: Role[] = ['SUPERVISOR']
  const studentRoles: Role[] = ['STUDENT']

  let teams: { id: string; name: string }[] = []

  if (adminRoles.includes(session.role as Role)) {
    teams = await prisma.team.findMany({
      where: { seasonId: activeSeason.id, status: 'APPROVED' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    allowedTeamIds = teams.map((t) => t.id)
  } else if (supervisorRoles.includes(session.role as Role)) {
    teams = await prisma.team.findMany({
      where: { supervisorId: session.id, seasonId: activeSeason.id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    allowedTeamIds = teams.map((t) => t.id)
    if (teamId && !allowedTeamIds.includes(teamId)) {
      targetTeamId = null
    }
  } else if (studentRoles.includes(session.role as Role)) {
    const member = await prisma.teamMember.findFirst({
      where: { userId: session.id },
      include: { team: true },
    })

    if (!member) {
      return NextResponse.json({ message: 'Not on a team' }, { status: 403 })
    }

    targetTeamId = member.teamId
    allowedTeamIds = [member.teamId]
    teams = [{ id: member.teamId, name: member.team.name }]
  }

  const where: {
    seasonId: string
    teamId?: string | { in: string[] }
    roundId?: string
  } = { seasonId: activeSeason.id }

  if (targetTeamId) {
    where.teamId = targetTeamId
  } else if (allowedTeamIds.length > 0) {
    where.teamId = { in: allowedTeamIds }
  }

  if (roundId) where.roundId = roundId

  const predictionErrors = await prisma.predictionError.findMany({
    where,
    include: {
      round: { select: { id: true, number: true, isFinal: true } },
      market: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
    },
    orderBy: [
      { round: { number: 'asc' } },
      { market: { name: 'asc' } },
      { metric: 'asc' },
      { weekOffset: 'asc' },
    ],
  })

  const rounds = activeSeason.rounds.map((r) => ({
    id: r.id,
    number: r.number,
    isFinal: r.isFinal,
    label: r.isFinal ? `Round ${r.number} (Final)` : `Round ${r.number}`,
  }))

  const markets = activeSeason.markets.map((sm) => ({
    id: sm.market.id,
    name: sm.market.name,
  }))

  const formatted = predictionErrors.map((pe) => ({
    id: pe.id,
    roundId: pe.roundId,
    roundNumber: pe.round.number,
    roundLabel: pe.round.isFinal ? `Round ${pe.round.number} (Final)` : `Round ${pe.round.number}`,
    marketId: pe.marketId,
    marketName: pe.market.name,
    teamId: pe.teamId,
    teamName: pe.team.name,
    metric: pe.metric,
    weekOffset: pe.weekOffset,
    predictedValue: pe.predictedValue,
    actualValue: pe.actualValue,
    absError: pe.absError,
  }))

  return NextResponse.json({
    seasonName: activeSeason.name,
    rounds,
    markets,
    teams,
    predictions: formatted,
    selectedTeamId: targetTeamId,
    canSelectTeam: adminRoles.includes(session.role as Role) || supervisorRoles.includes(session.role as Role),
  })
}