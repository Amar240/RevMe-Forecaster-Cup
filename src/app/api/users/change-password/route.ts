import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { requireUserOrResponse, jsonOk, jsonError, parseJson, ApiError } from '@/server/http'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
})

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const { currentPassword, newPassword } = await parseJson(request, changePasswordSchema)

    const fullUser = await prisma.user.findUnique({
      where: { id: user!.id },
      select: { passwordHash: true },
    })

    if (!fullUser) {
      throw new ApiError('User not found', 404, 'NOT_FOUND')
    }

    if (!fullUser.passwordHash) throw new ApiError('Set a password using password reset before changing it.', 409, 'CONFLICT')
    const valid = await verifyPassword(currentPassword, fullUser.passwordHash)
    if (!valid) {
      throw new ApiError('Current password is incorrect', 400, 'INVALID_INPUT')
    }

    const passwordHash = await hashPassword(newPassword)

    await prisma.user.update({
      where: { id: user!.id },
      data: { passwordHash },
    })

    return jsonOk({ message: 'Password updated successfully' })
  } catch (error) {
    return jsonError(error, 'Failed to change password')
  }
}
