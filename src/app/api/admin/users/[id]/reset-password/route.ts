import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { logAuditAction } from '@/lib/audit'
import { sendPasswordResetEmail } from '@/lib/email'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const targetUser = await prisma.user.findUnique({ where: { id } })
    if (!targetUser) throw new ApiError('User not found', 404, 'NOT_FOUND')

    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.user.update({ where: { id }, data: { resetToken, resetTokenExpiry } })
    await logAuditAction(user!.id, 'GENERATE_RESET_TOKEN', 'User', id, { userEmail: targetUser.email })

    const emailSent = await sendPasswordResetEmail(targetUser.email, resetToken)

    return jsonOk({
      message: emailSent
        ? 'Password reset email sent to the user'
        : 'Reset token generated but email could not be sent (SMTP not configured). The user can use the "Forgot Password" flow.',
    })
  } catch (error) {
    return jsonError(error, 'Failed to generate reset link')
  }
}
