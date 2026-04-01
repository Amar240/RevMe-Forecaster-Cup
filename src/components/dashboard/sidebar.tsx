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
  GraduationCap,
  FileText,
  Settings,
  Shield,
  Upload,
  Calculator,
  Building2,
  BookOpen,
  UserPlus,
  Inbox,
  CheckCircle,
  HelpCircle,
  MapPin,
  UserCog,
  Target,
  Mail,
  FileBarChart,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface SidebarProps {
  role: string
  mobileOpen?: boolean
  onMobileClose?: () => void
}

type NavItem = {
  name: string
  href: string
  icon: LucideIcon
  badgeKey?: 'joinRequests' | 'teamApprovals'
}

type NavGroup = {
  label: string
  items: NavItem[]
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
  { name: 'Students', href: '/supervisor/students', icon: GraduationCap },
  { name: 'Join Requests', href: '/supervisor/requests', icon: Inbox, badgeKey: 'joinRequests' },
  { name: 'Support Inbox', href: '/supervisor/support-inbox', icon: Inbox },
  { name: 'My Teams', href: '/teams', icon: Users },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Leaderboards', href: '/leaderboards', icon: Trophy },
  { name: 'Score Details', href: '/scoring-verification', icon: Target },
  { name: 'Market Info', href: '/market-info', icon: MapPin },
  { name: 'Settings', href: '/settings', icon: Settings },
]

const adminNavGroups: NavGroup[] = [
  {
    label: 'Operate',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Season', href: '/admin/season', icon: Shield },
      { name: 'Submissions', href: '/admin/submissions', icon: FileText },
      { name: 'Upload Actuals', href: '/admin/actuals', icon: Upload },
      { name: 'Scoring', href: '/admin/scoring', icon: Calculator },
      { name: 'Score Verification', href: '/scoring-verification', icon: Target },
      { name: 'Reports', href: '/admin/reports', icon: FileBarChart },
      { name: 'Communications', href: '/admin/communications', icon: Mail },
    ],
  },
  {
    label: 'People',
    items: [
      { name: 'Universities', href: '/admin/universities', icon: Building2 },
      { name: 'Supervisors', href: '/admin/supervisors', icon: UserCog },
      { name: 'Teams', href: '/admin/teams', icon: Users },
      { name: 'Team Approvals', href: '/admin/team-approvals', icon: CheckCircle, badgeKey: 'teamApprovals' },
      { name: 'Users', href: '/admin/users', icon: Users },
      { name: 'Sub-Admins', href: '/admin/sub-admins', icon: UserCog },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { name: 'Audit Logs', href: '/admin/audit-logs', icon: Shield },
      { name: 'Escalations', href: '/admin/escalations', icon: HelpCircle },
    ],
  },
  {
    label: 'Growth',
    items: [
      { name: 'Leaderboards', href: '/leaderboards', icon: Trophy },
      { name: 'Market Info', href: '/admin/market-info', icon: MapPin },
      { name: 'Demo Requests', href: '/admin/demo-requests', icon: Mail },
    ],
  },
  {
    label: 'System',
    items: [{ name: 'Settings', href: '/settings', icon: Settings }],
  },
]

const subAdminNavGroups: NavGroup[] = [
  {
    label: 'Operate',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Season', href: '/admin/season', icon: Shield },
      { name: 'Submissions', href: '/admin/submissions', icon: FileText },
      { name: 'Upload Actuals', href: '/admin/actuals', icon: Upload },
      { name: 'Scoring', href: '/admin/scoring', icon: Calculator },
      { name: 'Score Verification', href: '/scoring-verification', icon: Target },
      { name: 'Reports', href: '/admin/reports', icon: FileBarChart },
      { name: 'Communications', href: '/admin/communications', icon: Mail },
    ],
  },
  {
    label: 'People',
    items: [
      { name: 'Universities', href: '/admin/universities', icon: Building2 },
      { name: 'Supervisors', href: '/admin/supervisors', icon: UserCog },
      { name: 'Teams', href: '/admin/teams', icon: Users },
      { name: 'Team Approvals', href: '/admin/team-approvals', icon: CheckCircle, badgeKey: 'teamApprovals' },
      { name: 'Users', href: '/admin/users', icon: Users },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { name: 'Audit Logs', href: '/admin/audit-logs', icon: Shield },
      { name: 'Escalations', href: '/admin/escalations', icon: HelpCircle },
    ],
  },
  {
    label: 'Growth',
    items: [
      { name: 'Leaderboards', href: '/leaderboards', icon: Trophy },
      { name: 'Market Info', href: '/admin/market-info', icon: MapPin },
      { name: 'Demo Requests', href: '/admin/demo-requests', icon: Mail },
    ],
  },
  {
    label: 'System',
    items: [{ name: 'Settings', href: '/settings', icon: Settings }],
  },
]

export function Sidebar({ role, mobileOpen, onMobileClose }: SidebarProps) {
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

  const navItems = role === 'SUPERVISOR'
    ? supervisorNav
    : studentNav
  const navGroups = role === 'ADMIN'
    ? adminNavGroups
    : role === 'SUB_ADMIN'
    ? subAdminNavGroups
    : null

  const renderNavLink = (item: NavItem, onLinkClick?: () => void) => {
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
        onClick={onLinkClick}
        className={cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
          isActive
            ? 'bg-background text-primary shadow-sm before:absolute before:bottom-2 before:left-0 before:top-2 before:w-1 before:rounded-r-full before:bg-primary'
            : 'text-text-secondary hover:bg-background hover:text-foreground'
        )}
      >
        <item.icon className={cn('h-4.5 w-4.5 flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
        <span className="flex-1">{item.name}</span>
        {badgeCount > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </Link>
    )
  }

  const renderNavContent = (onLinkClick?: () => void) => (
    <nav className="space-y-6 px-3 py-4">
      {navGroups ? (
        navGroups.map((group) => (
          <details key={group.label} open className="space-y-2">
            <summary className="list-none px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {group.label}
            </summary>
            <div className="space-y-1">
              {group.items.map((item) => renderNavLink(item, onLinkClick))}
            </div>
          </details>
        ))
      ) : (
        <div className="space-y-1">
          {navItems.map((item) => renderNavLink(item, onLinkClick))}
        </div>
      )}
    </nav>
  )

  return (
    <>
      <aside className="hidden min-h-[calc(100vh-4rem)] w-72 border-r border-border bg-surface-secondary lg:block">
        {renderNavContent()}
      </aside>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
            onClick={onMobileClose}
          />
          <aside className="fixed left-0 top-0 z-50 h-full w-72 overflow-y-auto border-r border-border bg-surface-secondary shadow-popover lg:hidden">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <span className="font-display text-lg font-semibold text-foreground">Navigation</span>
              <button onClick={onMobileClose} className="rounded-md p-2 text-text-secondary transition-colors hover:bg-background hover:text-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            {renderNavContent(onMobileClose)}
          </aside>
        </>
      )}
    </>
  )
}
