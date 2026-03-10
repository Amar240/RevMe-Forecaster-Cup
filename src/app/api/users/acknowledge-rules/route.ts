import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    await prisma.user.update({
      where: { id: user!.id },
      data: { rulesAcknowledgedAt: new Date() },
    })

    return jsonOk({ message: 'Rules acknowledged' })
  } catch (error) {
    return jsonError(error, 'Failed to acknowledge rules')
  }
}
