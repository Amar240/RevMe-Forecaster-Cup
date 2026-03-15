'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  GraduationCap,
  Key,
  Loader2,
  LogOut,
  MoreVertical,
  RefreshCw,
  Shield,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react'
import { clientLogger } from '@/lib/client-logger'
import { changeUserRole, deleteUser, forceLogout, generateResetLink, listUsers } from '@/features/users/api'
import type { AdminUser } from '@/features/users/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AccessDenied } from '@/components/ui/access-denied'
import { usePermissions } from '@/hooks/usePermissions'
import { DataTable } from '@/components/ui/data-table'
import { CardSkeleton, TableSkeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

function getRoleVariant(role: string): 'medal' | 'success' | 'info' {
  if (role === 'ADMIN') return 'medal'
  if (role === 'SUPERVISOR') return 'success'
  return 'info'
}

export default function AdminUsersPage() {
  const { loading: permLoading, canPerform } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [showRoleDialog, setShowRoleDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [newRole, setNewRole] = useState('')
  const [resetLink, setResetLink] = useState('')
  const [logoutTarget, setLogoutTarget] = useState<AdminUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      const data = await listUsers()
      setUsers(data.users || [])
      setTotalUsers(data.total ?? data.users?.length ?? 0)
    } catch (error) {
      clientLogger.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!permLoading && canPerform('users:manage')) {
      void fetchUsers()
    }
  }, [permLoading, canPerform, fetchUsers])

  const handleChangeRole = async () => {
    if (!selectedUser || !newRole) return

    setActionLoading(selectedUser.id)
    try {
      await changeUserRole(selectedUser.id, newRole)
      await fetchUsers()
      setShowRoleDialog(false)
    } catch (error) {
      clientLogger.error('Change role failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to change role')
    } finally {
      setActionLoading(null)
    }
  }

  const handleGenerateResetLink = async (user: AdminUser) => {
    setActionLoading(user.id)
    try {
      const data = await generateResetLink(user.id)
      setResetLink(data.resetLink)
      setSelectedUser(user)
      setShowResetDialog(true)
    } catch (error) {
      clientLogger.error('Reset link failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate reset link')
    } finally {
      setActionLoading(null)
    }
  }

  const executeForceLogout = async (user: AdminUser) => {
    setActionLoading(user.id)
    try {
      const data = await forceLogout(user.id)
      toast.success(data.message)
    } catch (error) {
      clientLogger.error('Force logout failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to force logout')
    } finally {
      setActionLoading(null)
      setLogoutTarget(null)
    }
  }

  const executeDeleteUser = async (user: AdminUser) => {
    setActionLoading(user.id)
    try {
      await deleteUser(user.id)
      await fetchUsers()
    } catch (error) {
      clientLogger.error('Delete user failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete user')
    } finally {
      setActionLoading(null)
      setDeleteTarget(null)
    }
  }

  if (permLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!canPerform('users:manage')) {
    return (
      <AccessDenied
        title="Access Denied"
        message="You do not have permission to access User Management. Please contact an administrator for access."
      />
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-32 animate-pulse rounded bg-surface-secondary" />
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-6 md:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-24 animate-pulse rounded bg-surface-secondary" />
          </CardHeader>
          <CardContent>
            <TableSkeleton rows={5} columns={6} />
          </CardContent>
        </Card>
      </div>
    )
  }

  const students = users.filter((user) => user.role === 'STUDENT')
  const supervisors = users.filter((user) => user.role === 'SUPERVISOR')
  const admins = users.filter((user) => user.role === 'ADMIN')

  const columns = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (user: AdminUser) => <span className="font-medium text-foreground">{user.firstName} {user.lastName}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: (user: AdminUser) => <span className="text-text-secondary">{user.email}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (user: AdminUser) => <Badge variant={getRoleVariant(user.role)}>{user.role}</Badge>,
    },
    {
      key: 'university.name',
      header: 'University',
      sortable: true,
      render: (user: AdminUser) => <span className="text-text-secondary">{user.university?.name || '-'}</span>,
    },
    {
      key: 'team',
      header: 'Team',
      render: (user: AdminUser) => <span className="text-text-secondary">{user.teamMemberships[0]?.team.name || '-'}</span>,
    },
    {
      key: 'createdAt',
      header: 'Joined',
      sortable: true,
      render: (user: AdminUser) => <span className="text-text-muted">{new Date(user.createdAt).toLocaleDateString()}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (user: AdminUser) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={actionLoading === user.id}>
              {actionLoading === user.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setSelectedUser(user)
                setNewRole(user.role)
                setShowRoleDialog(true)
              }}
            >
              <Shield className="mr-2 h-4 w-4" />
              Change Role
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void handleGenerateResetLink(user)}>
              <Key className="mr-2 h-4 w-4" />
              Generate Reset Link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLogoutTarget(user)}>
              <LogOut className="mr-2 h-4 w-4" />
              Force Logout
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-error" onClick={() => setDeleteTarget(user)} disabled={user.role === 'ADMIN'}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">All Users</h1>
        <p className="text-text-secondary">{totalUsers} registered users</p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card variant="metric" className="bg-gradient-to-br from-surface-secondary to-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm font-medium text-text-secondary">
              <Users className="mr-2 h-4 w-4 text-foreground" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">{users.length}</p>
          </CardContent>
        </Card>

        <Card variant="metric" className="border-primary/10 bg-gradient-to-br from-primary-soft to-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm font-medium text-text-secondary">
              <GraduationCap className="mr-2 h-4 w-4 text-primary" />
              Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-primary">{students.length}</p>
          </CardContent>
        </Card>

        <Card variant="metric" className="border-success/10 bg-gradient-to-br from-success-background to-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm font-medium text-text-secondary">
              <UserCog className="mr-2 h-4 w-4 text-success" />
              Supervisors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-success">{supervisors.length}</p>
          </CardContent>
        </Card>

        <Card variant="metric" className="border-accent/10 bg-gradient-to-br from-accent-soft to-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm font-medium text-text-secondary">
              <Shield className="mr-2 h-4 w-4 text-accent" />
              Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-accent">{admins.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={users}
            columns={columns}
            searchKeys={['firstName', 'lastName', 'email']}
            searchPlaceholder="Search by name or email..."
            pageSize={20}
            filters={[
              {
                key: 'role',
                label: 'Role',
                options: [
                  { value: 'STUDENT', label: 'Student' },
                  { value: 'SUPERVISOR', label: 'Supervisor' },
                  { value: 'ADMIN', label: 'Admin' },
                ],
              },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Change role for {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENT">Student</SelectItem>
                  <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangeRole} disabled={actionLoading === selectedUser?.id || newRole === selectedUser?.role}>
              {actionLoading === selectedUser?.id ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Reset Link</DialogTitle>
            <DialogDescription>
              Share this link with {selectedUser?.firstName} {selectedUser?.lastName} to reset their password.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg border border-border bg-surface-secondary p-3">
              <p className="break-all font-mono text-sm text-foreground">{resetLink}</p>
            </div>
            <p className="mt-2 text-xs text-text-muted">This link expires in 24 hours.</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(resetLink)
                toast.success('Link copied to clipboard')
              }}
            >
              Copy Link
            </Button>
            <Button onClick={() => setShowResetDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={logoutTarget !== null}
        onOpenChange={(open) => {
          if (!open) setLogoutTarget(null)
        }}
        title="Force Logout"
        description={`Force logout ${logoutTarget?.firstName} ${logoutTarget?.lastName}? Their active sessions will be terminated.`}
        confirmLabel="Force Logout"
        variant="destructive"
        loading={actionLoading === logoutTarget?.id}
        onConfirm={() => {
          if (logoutTarget) void executeForceLogout(logoutTarget)
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Delete User"
        description={`Delete ${deleteTarget?.firstName} ${deleteTarget?.lastName}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={actionLoading === deleteTarget?.id}
        onConfirm={() => {
          if (deleteTarget) void executeDeleteUser(deleteTarget)
        }}
      />
    </div>
  )
}
