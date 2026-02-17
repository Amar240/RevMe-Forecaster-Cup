import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function POST() {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { rulesAcknowledgedAt: new Date() },
    })

    return NextResponse.json({ message: 'Rules acknowledged' })
  } catch (error) {
    console.error('Acknowledge rules error:', error)
    return NextResponse.json({ message: 'Failed to acknowledge rules' }, { status: 500 })
  }
}
