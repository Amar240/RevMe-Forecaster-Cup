'use client'

import { csrfFetch } from '@/lib/csrf'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BarChart3, LogOut, User as UserIcon } from 'lucide-react'
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
}

export function Header({ user }: HeaderProps) {
  const router = useRouter()

  const handleLogout = async () => {
    await csrfFetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="bg-white border-b sticky top-0 z-40">
      <div className="flex items-center justify-between h-16 px-4 lg:px-8">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <BarChart3 className="h-7 w-7 text-blue-600" />
          <span className="text-lg font-bold text-gray-900 hidden sm:block">RevME Forecaster Cup</span>
        </Link>

        <div className="flex items-center space-x-4">
          <NotificationsDropdown />
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <UserIcon className="h-4 w-4" />
            <span className="hidden md:inline">
              {user.firstName} {user.lastName}
            </span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {user.role}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
