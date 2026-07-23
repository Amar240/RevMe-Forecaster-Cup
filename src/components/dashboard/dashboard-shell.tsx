'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Header } from '@/components/dashboard/header'
import { Sidebar } from '@/components/dashboard/sidebar'
import { cn } from '@/lib/utils'

interface DashboardShellProps {
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    role: string
  }
  children: React.ReactNode
}

const legacySurfaceRoutes = [
  '/scores',
  '/support',
  '/scoring-verification',
  '/supervisor/support-inbox',
  '/admin/season',
  '/admin/audit-logs',
  '/admin/communications',
  '/admin/market-info',
  '/admin/demo-requests',
  '/admin/sub-admins',
  '/admin/reports',
]

export function DashboardShell({ user, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const useLegacySurface = legacySurfaceRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header user={user} onToggleSidebar={() => setMobileOpen((value) => !value)} />
      <div className="flex min-h-[calc(100vh-4rem)]">
        <Sidebar
          role={user.role}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className={cn('mx-auto w-full max-w-[1520px]', useLegacySurface && 'legacy-surface')}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
