import { destroySession } from '@/lib/auth'
import { jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    await destroySession()
    return jsonOk({ message: 'Logged out successfully' })
  } catch (error) {
    return jsonError(error, 'Logout failed')
  }
}
