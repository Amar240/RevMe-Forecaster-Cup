import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSession } from '@/lib/auth'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'

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
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />
      <div className="flex">
        <Sidebar role={user.role} />
        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
