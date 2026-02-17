import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logAuditAction } from '@/lib/audit'
import crypto from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const targetUser = await prisma.user.findUnique({ where: { id } })
    if (!targetUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.user.update({
      where: { id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    })

    await logAuditAction(user.id, 'GENERATE_RESET_TOKEN', 'User', id, {
      userEmail: targetUser.email,
    })

    const resetLink = `${process.env.APP_URL || 'https://rev-me.org'}/reset-password?token=${resetToken}`

    return NextResponse.json({
      message: 'Password reset link generated',
      resetLink,
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ message: 'Failed to generate reset link' }, { status: 500 })
  }
}
