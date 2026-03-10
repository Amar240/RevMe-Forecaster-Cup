'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  LayoutDashboard, Users, FileText, Trophy, Shield, Settings,
  Send, Upload, AlertTriangle, BarChart3, GraduationCap,
  Mail, FileBarChart, Building2, UserCheck, MessageSquare, BookOpen,
} from 'lucide-react'

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

  const navigate = useCallback((path: string) => {
    router.push(path)
    setOpen(false)
  }, [router])

  const commands: CommandItem[] = useMemo(() => [
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
  ], [navigate])

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.description?.toLowerCase().includes(q) ||
      cmd.keywords.some(k => k.includes(q))
    )
  }, [commands, query])

  const groups = useMemo(() => {
    const groupMap = new Map<string, CommandItem[]>()
    for (const cmd of filteredCommands) {
      const existing = groupMap.get(cmd.group) || []
      existing.push(cmd)
      groupMap.set(cmd.group, existing)
    }
    return Array.from(groupMap.entries())
  }, [filteredCommands])

  const flatItems = filteredCommands

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, flatItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (flatItems[selectedIndex]) {
        flatItems[selectedIndex].action()
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setQuery(''); }}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden" onKeyDown={handleKeyDown}>
        <div className="flex items-center border-b px-4">
          <span className="text-gray-400 mr-2 text-sm">⌘</span>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="border-0 focus-visible:ring-0 text-base h-12"
            autoFocus
          />
        </div>
        <div className="max-h-[350px] overflow-y-auto py-2">
          {groups.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No results found</p>
          ) : (
            groups.map(([group, items]) => (
              <div key={group}>
                <p className="px-4 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">{group}</p>
                {items.map((item) => {
                  const globalIndex = flatItems.indexOf(item)
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      onClick={() => item.action()}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        globalIndex === selectedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
                        {item.description && <p className="text-xs text-gray-500 truncate">{item.description}</p>}
                      </div>
                      {globalIndex === selectedIndex && (
                        <span className="text-xs text-gray-400">↵</span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
        <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-gray-400">
          <div className="flex gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <span>Ctrl+K</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
