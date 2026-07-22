import { jsonOk } from '@/server/http'
import { isGoogleOAuthConfigured } from '@/server/oauth-config'

export const dynamic = 'force-dynamic'

export async function GET() { return jsonOk({ enabled: isGoogleOAuthConfigured() }) }
