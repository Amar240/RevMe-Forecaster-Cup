'use client'

import Link from 'next/link'
import { csrfFetch } from '@/lib/csrf'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Send,
  Trophy,
  Users,
  FileText,
  Settings,
  Shield,
  Upload,
  Calculator,
  Building2,
  BookOpen,
  Zap,
  UserPlus,
  Inbox,
  CheckCircle,
  HelpCircle,
  MapPin,
  UserCog,
  Target,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface SidebarProps {
  role: string
}

type NavItem = {
  name: string
  href: string
  icon: LucideIcon
  badgeKey?: 'joinRequests' | 'teamApprovals'
}

const studentNav: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Join Team', href: '/join-team', icon: UserPlus },
  { name: 'Submit Forecast', href: '/submit', icon: Send },
  { name: 'My Scores', href: '/scores', icon: FileText },
  { name: 'Leaderboards', href: '/leaderboards', icon: Trophy },
  { name: 'Score Details', href: '/scoring-verification', icon: Target },
  { name: 'Market Info', href: '/market-info', icon: MapPin },
  { name: 'Guidelines + Help', href: '/rules', icon: BookOpen },
  { name: 'Support', href: '/support', icon: HelpCircle },
  { name: 'Settings', href: '/settings', icon: Settings },
]

const supervisorNav: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Join Requests', href: '/supervisor/requests', icon: Inbox, badgeKey: 'joinRequests' },
  { name: 'Support Inbox', href: '/supervisor/support-inbox', icon: Inbox },
  { name: 'My Teams', href: '/teams', icon: Users },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Leaderboards', href: '/leaderboards', icon: Trophy },
  { name: 'Score Details', href: '/scoring-verification', icon: Target },
  { name: 'Market Info', href: '/market-info', icon: MapPin },
  { name: 'Settings', href: '/settings', icon: Settings },
]

const adminNav: NavItem[] = [
  { name: 'Command Center', href: '/admin/command-center', icon: Zap },
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Season', href: '/admin/season', icon: Shield },
  { name: 'Universities', href: '/admin/universities', icon: Building2 },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Teams', href: '/admin/teams', icon: Users },
  { name: 'Team Approvals', href: '/admin/team-approvals', icon: CheckCircle, badgeKey: 'teamApprovals' },
  { name: 'Sub-Admins', href: '/admin/sub-admins', icon: UserCog },
  { name: 'Submissions', href: '/admin/submissions', icon: FileText },
  { name: 'Upload Actuals', href: '/admin/actuals', icon: Upload },
  { name: 'Scoring', href: '/admin/scoring', icon: Calculator },
  { name: 'Score Verification', href: '/scoring-verification', icon: Target },
  { name: 'Audit Logs', href: '/admin/audit-logs', icon: Shield },
  { name: 'Leaderboards', href: '/leaderboards', icon: Trophy },
  { name: 'Market Info', href: '/admin/market-info', icon: MapPin },
  { name: 'Escalations', href: '/admin/escalations', icon: HelpCircle },
  { name: 'Settings', href: '/settings', icon: Settings },
]

const subAdminNav: NavItem[] = [
  { name: 'Command Center', href: '/admin/command-center', icon: Zap },
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Season', href: '/admin/season', icon: Shield },
  { name: 'Universities', href: '/admin/universities', icon: Building2 },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Teams', href: '/admin/teams', icon: Users },
  { name: 'Team Approvals', href: '/admin/team-approvals', icon: CheckCircle, badgeKey: 'teamApprovals' },
  { name: 'Submissions', href: '/admin/submissions', icon: FileText },
  { name: 'Upload Actuals', href: '/admin/actuals', icon: Upload },
  { name: 'Scoring', href: '/admin/scoring', icon: Calculator },
  { name: 'Score Verification', href: '/scoring-verification', icon: Target },
  { name: 'Audit Logs', href: '/admin/audit-logs', icon: Shield },
  { name: 'Leaderboards', href: '/leaderboards', icon: Trophy },
  { name: 'Market Info', href: '/admin/market-info', icon: MapPin },
  { name: 'Escalations', href: '/admin/escalations', icon: HelpCircle },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const [joinRequestsCount, setJoinRequestsCount] = useState(0)
  const [teamApprovalsCount, setTeamApprovalsCount] = useState(0)

  useEffect(() => {
    const loadCounts = async () => {
      try {
        if (role === 'SUPERVISOR') {
          const res = await csrfFetch('/api/supervisor/join-requests')
          if (res.ok) {
            const data = await res.json()
            setJoinRequestsCount(Array.isArray(data.requests) ? data.requests.length : 0)
          }
        }

        if (role === 'ADMIN' || role === 'SUB_ADMIN') {
          const res = await csrfFetch('/api/admin/teams/pending')
          if (res.ok) {
            const data = await res.json()
            setTeamApprovalsCount(Array.isArray(data.teams) ? data.teams.length : 0)
          }
        }
      } catch {
        // Ignore sidebar badge failures
      }
    }

    loadCounts()
  }, [role])

  const navItems = role === 'ADMIN' 
    ? adminNav 
    : role === 'SUB_ADMIN'
    ? subAdminNav
    : role === 'SUPERVISOR' 
    ? supervisorNav 
    : studentNav

  return (
    <aside className="w-64 bg-white border-r min-h-[calc(100vh-4rem)] hidden lg:block">
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const badgeCount =
            item.badgeKey === 'joinRequests'
              ? joinRequestsCount
              : item.badgeKey === 'teamApprovals'
              ? teamApprovalsCount
              : 0
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="flex-1">{item.name}</span>
              {badgeCount > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 text-xs font-semibold rounded-full bg-red-500 text-white flex items-center justify-center">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
