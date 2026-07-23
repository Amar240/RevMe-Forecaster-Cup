import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { SupervisorImportClient } from './supervisor-import-client'
import { isImportAssistEnabled } from '@/server/import-assist'
import { getCurrentOperationalSeason } from '@/server/season'

export default async function SupervisorImportPage() {
  const user = await getSession()
  if (!user) redirect('/login')
  if (user.role !== 'SUPERVISOR') redirect('/dashboard')
  const season = await getCurrentOperationalSeason({ select: { id: true, registrationOpen: true, importAssistMode: true } })
  return <SupervisorImportClient seasonAvailable={Boolean(season)} registrationOpen={season?.registrationOpen ?? false} assistEnabled={Boolean(season && isImportAssistEnabled() && season.importAssistMode === 'ON_DEMAND')} />
}
