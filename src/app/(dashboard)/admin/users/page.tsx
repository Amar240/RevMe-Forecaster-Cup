'use client'

import { clientLogger } from '@/lib/client-logger'
import {
  changeUserRole,
  deleteUser,
  forceLogout,
  generateResetLink,
  listUsers,
} from '@/features/users/api'
import type { AdminUser } from '@/features/users/types'
import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AccessDenied } from '@/components/ui/access-denied'
import { usePermissions } from '@/hooks/usePermissions'
import { Users, GraduationCap, UserCog, Shield, MoreVertical, RefreshCw, Key, LogOut, Trash2, Loader2 } from 'lucide-react'
import { DataTable } from '@/components/ui/data-table'
import { CardSkeleton, TableSkeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

export default function AdminUsersPage() {
  const { loading: permLoading, canPerform } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [showRoleDialog, setShowRoleDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [newRole, setNewRole] = useState<string>('')
  const [resetLink, setResetLink] = useState('')

  const fetchUsers = useCallback(async () => {
    try {
      const data = await listUsers({ page, pageSize })
      setUsers(data.users || [])
      setTotalUsers(data.total || 0)
    } catch (error) {
      clientLogger.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    if (!permLoading && canPerform('users:manage')) {
      fetchUsers()
    }
  }, [permLoading, canPerform, fetchUsers])

  if (permLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!canPerform('users:manage')) {
    return <AccessDenied title="Access Denied" message="You do not have permission to access User Management. Please contact an administrator for access." />
  }

  const handleChangeRole = async () => {
    if (!selectedUser || !newRole) return
    setActionLoading(selectedUser.id)
    try {
      await changeUserRole(selectedUser.id, newRole)
      fetchUsers()
      setShowRoleDialog(false)
    } catch (error) {
      clientLogger.error('Change role failed:', error)
      alert(error instanceof Error ? error.message : 'An error occurred')
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
      alert(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setActionLoading(null)
    }
  }

  const handleForceLogout = async (user: AdminUser) => {
    if (!confirm(`Force logout ${user.firstName} ${user.lastName}? Their active sessions will be terminated.`)) return
    setActionLoading(user.id)
    try {
      const data = await forceLogout(user.id)
      alert(data.message)
    } catch (error) {
      clientLogger.error('Force logout failed:', error)
      alert(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteUser = async (user: AdminUser) => {
    if (!confirm(`Delete ${user.firstName} ${user.lastName}? This action cannot be undone.`)) return
    setActionLoading(user.id)
    try {
      await deleteUser(user.id)
      fetchUsers()
    } catch (error) {
      clientLogger.error('Delete user failed:', error)
      alert(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid md:grid-cols-4 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <TableSkeleton rows={5} columns={6} />
          </CardContent>
        </Card>
      </div>
    )
  }

  const students = users.filter((u) => u.role === 'STUDENT')
  const supervisors = users.filter((u) => u.role === 'SUPERVISOR')
  const admins = users.filter((u) => u.role === 'ADMIN')
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize))

  const columns = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (user: AdminUser) => (
        <span className="font-medium">{user.firstName} {user.lastName}</span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: (user: AdminUser) => (
        <span className="text-gray-600">{user.email}</span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (user: AdminUser) => (
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            user.role === 'ADMIN'
              ? 'bg-purple-100 text-purple-700'
              : user.role === 'SUPERVISOR'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          {user.role}
        </span>
      ),
    },
    {
      key: 'university.name',
      header: 'University',
      sortable: true,
      render: (user: AdminUser) => (
        <span className="text-gray-600">{user.university?.name || '-'}</span>
      ),
    },
    {
      key: 'team',
      header: 'Team',
      render: (user: AdminUser) => (
        <span className="text-gray-600">{user.teamMemberships[0]?.team.name || '-'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      sortable: true,
      render: (user: AdminUser) => (
        <span className="text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (user: AdminUser) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={actionLoading === user.id}>
              {actionLoading === user.id ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <MoreVertical className="h-4 w-4" />
              )}
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
              <Shield className="h-4 w-4 mr-2" />
              Change Role
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleGenerateResetLink(user)}>
              <Key className="h-4 w-4 mr-2" />
              Generate Reset Link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleForceLogout(user)}>
              <LogOut className="h-4 w-4 mr-2" />
              Force Logout
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => handleDeleteUser(user)}
              disabled={user.role === 'ADMIN'}
            >
              <Trash2 className="h-4 w-4 mr-2" />
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
        <h1 className="text-2xl font-bold text-gray-900">All Users</h1>
        <p className="text-gray-600">{totalUsers} registered users</p>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-gray-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{users.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <GraduationCap className="h-4 w-4 mr-2" />
              Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{students.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <UserCog className="h-4 w-4 mr-2" />
              Supervisors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600">{supervisors.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Shield className="h-4 w-4 mr-2" />
              Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-600">{admins.length}</p>
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
            pageSize={15}
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
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
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
            <Button
              onClick={handleChangeRole}
              disabled={actionLoading === selectedUser?.id || newRole === selectedUser?.role}
            >
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
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm break-all font-mono">{resetLink}</p>
            </div>
            <p className="text-xs text-gray-500 mt-2">This link expires in 24 hours.</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(resetLink)
                alert('Link copied to clipboard!')
              }}
            >
              Copy Link
            </Button>
            <Button onClick={() => setShowResetDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}





