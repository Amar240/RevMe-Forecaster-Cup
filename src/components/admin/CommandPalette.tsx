'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Building2,
  FileBarChart,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Search,
  Send,
  Settings,
  Shield,
  Trophy,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ElementType
  action: () => void
  keywords: string[]
  group: string
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const router = useRouter()

  const navigate = useCallback(
    (path: string) => {
      router.push(path)
      setOpen(false)
    },
    [router],
  )

  const commands: CommandItem[] = useMemo(
    () => [
      { id: 'nav-dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, action: () => navigate('/admin/command-center'), keywords: ['dashboard', 'home', 'command center'], group: 'Navigation' },
      { id: 'nav-teams', label: 'Go to Teams', icon: Users, action: () => navigate('/admin/teams'), keywords: ['teams', 'manage'], group: 'Navigation' },
      { id: 'nav-users', label: 'Go to Users', icon: Users, action: () => navigate('/admin/users'), keywords: ['users', 'manage'], group: 'Navigation' },
      { id: 'nav-submissions', label: 'Go to Submissions', icon: FileText, action: () => navigate('/admin/submissions'), keywords: ['submissions', 'forecasts'], group: 'Navigation' },
      { id: 'nav-scoring', label: 'Go to Scoring', icon: Trophy, action: () => navigate('/admin/scoring'), keywords: ['scoring', 'scores', 'results'], group: 'Navigation' },
      { id: 'nav-actuals', label: 'Go to Actuals', icon: Upload, action: () => navigate('/admin/actuals'), keywords: ['actuals', 'upload'], group: 'Navigation' },
      { id: 'nav-leaderboard', label: 'Go to Leaderboard', icon: BarChart3, action: () => navigate('/leaderboards'), keywords: ['leaderboard', 'rankings'], group: 'Navigation' },
      { id: 'nav-season', label: 'Go to Season', icon: Settings, action: () => navigate('/admin/season'), keywords: ['season', 'configure', 'settings'], group: 'Navigation' },
      { id: 'nav-universities', label: 'Go to Universities', icon: Building2, action: () => navigate('/admin/universities'), keywords: ['universities', 'schools'], group: 'Navigation' },
      { id: 'nav-sub-admins', label: 'Go to Sub-Admins', icon: Shield, action: () => navigate('/admin/sub-admins'), keywords: ['sub-admins', 'permissions'], group: 'Navigation' },
      { id: 'nav-escalations', label: 'Go to Escalations', icon: AlertTriangle, action: () => navigate('/admin/escalations'), keywords: ['escalations', 'tickets', 'support'], group: 'Navigation' },
      { id: 'nav-audit', label: 'Go to Audit Logs', icon: BookOpen, action: () => navigate('/admin/audit-logs'), keywords: ['audit', 'logs', 'history'], group: 'Navigation' },
      { id: 'nav-market-info', label: 'Go to Market Info', icon: GraduationCap, action: () => navigate('/admin/market-info'), keywords: ['market', 'info', 'resources'], group: 'Navigation' },
      { id: 'nav-reports', label: 'Go to Reports', icon: FileBarChart, action: () => navigate('/admin/reports'), keywords: ['reports', 'export', 'instructor'], group: 'Navigation' },
      { id: 'nav-communications', label: 'Go to Communications', icon: Mail, action: () => navigate('/admin/communications'), keywords: ['communications', 'email', 'notify'], group: 'Navigation' },
      { id: 'nav-demo-requests', label: 'Go to Demo Requests', icon: MessageSquare, action: () => navigate('/admin/demo-requests'), keywords: ['demo', 'requests'], group: 'Navigation' },
      { id: 'nav-team-approvals', label: 'Go to Team Approvals', icon: UserCheck, action: () => navigate('/admin/teams?tab=pending'), keywords: ['approvals', 'pending', 'teams'], group: 'Navigation' },
      { id: 'act-run-scoring', label: 'Run Scoring', description: 'Navigate to scoring page to run scoring', icon: Trophy, action: () => navigate('/admin/scoring'), keywords: ['run', 'scoring', 'calculate'], group: 'Actions' },
      { id: 'act-upload-actuals', label: 'Upload Actuals', description: 'Navigate to actuals page to upload', icon: Upload, action: () => navigate('/admin/actuals'), keywords: ['upload', 'actuals', 'data'], group: 'Actions' },
      { id: 'act-send-reminder', label: 'Send Reminders', description: 'Go to communications to send reminders', icon: Send, action: () => navigate('/admin/communications'), keywords: ['send', 'reminder', 'notify'], group: 'Actions' },
      { id: 'act-export-report', label: 'Generate Report', description: 'Go to reports page', icon: FileBarChart, action: () => navigate('/admin/reports'), keywords: ['generate', 'report', 'export', 'csv'], group: 'Actions' },
    ],
    [navigate],
  )

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands

    const loweredQuery = query.toLowerCase()

    return commands.filter(
      (command) =>
        command.label.toLowerCase().includes(loweredQuery) ||
        command.description?.toLowerCase().includes(loweredQuery) ||
        command.keywords.some((keyword) => keyword.includes(loweredQuery)),
    )
  }, [commands, query])

  const groups = useMemo(() => {
    const groupMap = new Map<string, CommandItem[]>()
    for (const command of filteredCommands) {
      const items = groupMap.get(command.group) || []
      items.push(command)
      groupMap.set(command.group, items)
    }
    return Array.from(groupMap.entries())
  }, [filteredCommands])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((value) => Math.min(value + 1, filteredCommands.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((value) => Math.max(value - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      filteredCommands[selectedIndex]?.action()
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        setQuery('')
      }}
    >
      <DialogContent
        className="overflow-hidden border-border bg-card p-0 shadow-popover sm:max-w-[560px]"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Search className="h-4 w-4" />
          </div>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a command or search..."
            className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            autoFocus
          />
        </div>

        <div className="max-h-[360px] overflow-y-auto py-2">
          {groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-secondary">No results found</p>
          ) : (
            groups.map(([group, items]) => (
              <div key={group}>
                <p className="px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                  {group}
                </p>
                {items.map((item) => {
                  const globalIndex = filteredCommands.indexOf(item)
                  const Icon = item.icon
                  const selected = globalIndex === selectedIndex

                  return (
                    <button
                      key={item.id}
                      onClick={() => item.action()}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        selected
                          ? 'bg-primary-soft text-primary'
                          : 'text-text-secondary hover:bg-surface-secondary hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{item.label}</p>
                        {item.description && (
                          <p className="truncate text-xs text-text-muted">
                            {item.description}
                          </p>
                        )}
                      </div>
                      {selected && <span className="text-xs text-text-muted">Enter</span>}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-text-muted">
          <div className="flex gap-3">
            <span>Up/Down Navigate</span>
            <span>Enter Select</span>
            <span>Esc Close</span>
          </div>
          <span>Ctrl+K</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
