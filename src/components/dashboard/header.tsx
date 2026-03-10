'use client'

import { csrfFetch } from '@/lib/csrf'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { BarChart3, LogOut, Menu, User as UserIcon, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NotificationsDropdown } from '@/components/notifications-dropdown'

interface HeaderProps {
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    role: string
  }
  onToggleSidebar?: () => void
}

export function Header({ user, onToggleSidebar }: HeaderProps) {
  const router = useRouter()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const handleLogout = async () => {
    await csrfFetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <header className="bg-[#070B18] border-b border-white/5 sticky top-0 z-40">
      <div className="flex items-center justify-between h-16 px-4 lg:px-8">
        <div className="flex items-center space-x-2">
          {onToggleSidebar && (
            <Button variant="ghost" size="sm" className="lg:hidden text-slate-400 hover:text-white hover:bg-white/5" onClick={onToggleSidebar}>
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <Link href="/dashboard" className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white hidden sm:block">RevME Forecaster Cup</span>
          </Link>
        </div>

        <div className="flex items-center space-x-3">
          <NotificationsDropdown />
          {mounted && (
            <Button variant="ghost" size="sm" onClick={toggleTheme} className="h-9 w-9 p-0 text-slate-400 hover:text-white hover:bg-white/5">
              {resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4 text-yellow-500" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          )}
          <div className="flex items-center space-x-2 text-sm text-slate-400">
            <UserIcon className="h-4 w-4" />
            <span className="hidden md:inline">
              {user.firstName} {user.lastName}
            </span>
            <span className="text-xs bg-violet-500/10 border border-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">
              {user.role}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-400 hover:text-white hover:bg-white/5">
            <LogOut className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
