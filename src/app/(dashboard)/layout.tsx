import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSession } from '@/lib/auth'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { CommandPalette } from '@/components/admin/CommandPalette'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSession()

  if (!user) {
    redirect('/login')
  }

  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''
  
  if (user.role === 'STUDENT' && !user.rulesAcknowledgedAt) {
    const allowedPaths = ['/rules', '/settings', '/logout']
    const isAllowedPath = allowedPaths.some(path => pathname.startsWith(path) || pathname === path)
    
    if (!isAllowedPath && pathname !== '/rules') {
      redirect('/rules')
    }
  }

  return (
    <>
      {user?.role === 'ADMIN' || user?.role === 'SUB_ADMIN' ? <CommandPalette /> : null}
      <DashboardShell user={user}>{children}</DashboardShell>
    </>
  )
}
