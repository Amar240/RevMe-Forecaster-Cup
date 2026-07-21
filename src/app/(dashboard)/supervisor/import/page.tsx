import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { SupervisorImportClient } from './supervisor-import-client'
import { isImportAssistEnabled } from '@/server/import-assist'

export default async function SupervisorImportPage() {
  const user = await getSession()
  if (!user) redirect('/login')
  if (user.role !== 'SUPERVISOR') redirect('/dashboard')
  return <SupervisorImportClient assistEnabled={isImportAssistEnabled()} />
}
