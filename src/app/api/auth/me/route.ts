import { requireUserOrResponse, jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    return jsonOk({
      user: {
        id: user!.id,
        email: user!.email,
        firstName: user!.firstName,
        lastName: user!.lastName,
        role: user!.role,
      },
    })
  } catch (error) {
    return jsonError(error, 'Authentication check failed')
  }
}
