'use client'

import { useState } from 'react'
import { Header } from '@/components/dashboard/header'
import { Sidebar } from '@/components/dashboard/sidebar'

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

export function DashboardShell({ user, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

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
          <div className="mx-auto w-full max-w-[1520px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
