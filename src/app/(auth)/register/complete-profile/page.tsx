import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/auth/auth-shell'
import { CompleteGoogleProfile } from './profile-client'
import { getGoogleOAuthConfig } from '@/server/oauth-config'
import { OAUTH_TTL_MS, readOAuthCookie, SIGNUP_COOKIE } from '@/server/oauth-cookies'

type Pending = { email: string; givenName: string; familyName: string; createdAt: number }
export const dynamic = 'force-dynamic'
export default async function Page() {
  if (!getGoogleOAuthConfig()) redirect('/register')
  const pending = await readOAuthCookie<Pending>(SIGNUP_COOKIE, 'signup')
  if (!pending || Date.now() - pending.createdAt >= OAUTH_TTL_MS) redirect('/register')
  return <AuthShell title="Complete your profile" description="Choose your competition role and university."><CompleteGoogleProfile identity={{ email: pending.email, firstName: pending.givenName, lastName: pending.familyName }}/></AuthShell>
}
