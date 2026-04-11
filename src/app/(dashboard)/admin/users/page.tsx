'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Edit,
  GraduationCap,
  Key,
  Loader2,
  LogOut,
  MoreVertical,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
  UserCog,
  Users,
} from 'lucide-react'
import { clientLogger } from '@/lib/client-logger'
import { csrfFetch } from '@/lib/csrf'
import {
  createStudent,
  forceLogout,
  listUsers,
  sendResetPasswordEmail,
  setStudentActiveStatus,
  updateStudent,
} from '@/features/users/api'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  const [universities, setUniversities] = useState<{ id: string; name: string }[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedStudent, setSelectedStudent] = useState<AdminUser | null>(null)
  const [showStudentDialog, setShowStudentDialog] = useState(false)
  const [savingStudent, setSavingStudent] = useState(false)
  const [studentForm, setStudentForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    universityId: '',
  })
  const [logoutTarget, setLogoutTarget] = useState<AdminUser | null>(null)
  const [statusTarget, setStatusTarget] = useState<AdminUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [bulkCsv, setBulkCsv] = useState('')
  const [bulkImporting, setBulkImporting] = useState(false)
  const [bulkResults, setBulkResults] = useState<{ created: number; skipped: number; errors: number } | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      const data = await listUsers()
      setUsers(data.users || [])
      setTotalUsers(data.total ?? data.users?.length ?? 0)
    } catch (error) {
      clientLogger.error('Failed to fetch users:', error)
    }
  }, [])

  const fetchUniversities = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/universities')
      const data = await res.json() as { universities?: { id: string; name: string }[]; message?: string }
      if (!res.ok) {
        throw new Error(data.message || 'Failed to load universities')
      }

      setUniversities(data.universities ?? [])
    } catch (error) {
      clientLogger.error('Failed to fetch universities:', error)
    }
  }, [])

  useEffect(() => {
    if (!permLoading && canPerform('users:manage')) {
      setLoading(true)
      void Promise.all([fetchUsers(), fetchUniversities()]).finally(() => {
        setLoading(false)
      })
    }
  }, [permLoading, canPerform, fetchUsers, fetchUniversities])

  const resetStudentForm = useCallback(() => {
    setSelectedStudent(null)
    setStudentForm({
      firstName: '',
      lastName: '',
      email: '',
      universityId: '',
    })
  }, [])

  const openCreateStudentDialog = () => {
    resetStudentForm()
    setShowStudentDialog(true)
  }

  const openEditStudentDialog = (user: AdminUser) => {
    setSelectedStudent(user)
    setStudentForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      universityId: user.universityId ?? '',
    })
    setShowStudentDialog(true)
  }

  const handleSaveStudent = async () => {
    if (!studentForm.firstName.trim() || !studentForm.lastName.trim() || !studentForm.email.trim() || !studentForm.universityId) {
      toast.error('First name, last name, email, and university are required.')
      return
    }

    setSavingStudent(true)
    try {
      if (selectedStudent) {
        await updateStudent(selectedStudent.id, studentForm)
        toast.success('Student updated successfully')
      } else {
        const data = await createStudent(studentForm)
        toast.success(
          data.emailSent
            ? 'Student created and password reset email sent'
            : 'Student created. Password reset email could not be sent.'
        )
      }

      await fetchUsers()
      resetStudentForm()
      setShowStudentDialog(false)
    } catch (error) {
      clientLogger.error('Save student failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save student')
    } finally {
      setSavingStudent(false)
    }
  }

  const handleSendResetEmail = async (user: AdminUser) => {
    setActionLoading(user.id)
    try {
      const data = await sendResetPasswordEmail(user.id)
      toast.success(data.message)
    } catch (error) {
      clientLogger.error('Reset email failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send password reset email')
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

  const executeStatusChange = async (user: AdminUser) => {
    setActionLoading(user.id)
    try {
      await setStudentActiveStatus(user.id, !user.isActive)
      toast.success(user.isActive ? 'Student deactivated' : 'Student reactivated')
      await fetchUsers()
    } catch (error) {
      clientLogger.error('Student status change failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update student status')
    } finally {
      setActionLoading(null)
      setStatusTarget(null)
    }
  }

  const executeDeleteUser = async (user: AdminUser) => {
    setActionLoading(user.id)
    try {
      const res = await csrfFetch(`/api/admin/users/${user.id}/delete`, {
        method: 'DELETE',
      })
      const data = await res.json() as { message?: string; error?: string }

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to delete user')
      }

      toast.success(data.message || 'User deleted successfully')
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
        message="You do not have permission to manage users. Contact your administrator if you need access."
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

  const handleBulkImport = async () => {
    if (!bulkCsv.trim()) return
    setBulkImporting(true)
    setBulkResults(null)
    try {
      const lines = bulkCsv.trim().split('\n').filter((l) => l.trim())
      const header = lines[0].toLowerCase()
      const hasHeader = header.includes('email') || header.includes('first') || header.includes('role')
      const dataLines = hasHeader ? lines.slice(1) : lines

      const rows = dataLines.map((line) => {
        const [email, firstName, lastName, role, universityName, password] = line.split(',').map((s) => s.trim())
        return { email, firstName, lastName, role: (role || 'STUDENT').toUpperCase(), universityName, password: password || undefined }
      }).filter((r) => r.email && r.firstName && r.lastName && r.universityName)

      if (rows.length === 0) {
        toast.error('No valid rows found. Check your CSV format.')
        return
      }

      const res = await csrfFetch('/api/admin/users/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, skipExisting: true }),
      })
      const data = await res.json() as { summary?: { created: number; skipped: number; errors: number }; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setBulkResults(data.summary ?? null)
      toast.success(`Import done: ${data.summary?.created ?? 0} created, ${data.summary?.skipped ?? 0} skipped`)
      void fetchUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk import failed')
    } finally {
      setBulkImporting(false)
    }
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
            {user.role === 'STUDENT' ? (
              <>
                <DropdownMenuItem onClick={() => openEditStudentDialog(user)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Student
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusTarget(user)}>
                  <Shield className="mr-2 h-4 w-4" />
                  {user.isActive ? 'Deactivate Student' : 'Reactivate Student'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem onClick={() => void handleSendResetEmail(user)}>
              <Key className="mr-2 h-4 w-4" />
              Send Password Reset Email
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLogoutTarget(user)}>
              <LogOut className="mr-2 h-4 w-4" />
              Force Logout
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {user.canDelete ? (
              <DropdownMenuItem
                className="text-error focus:text-error"
                onClick={() => setDeleteTarget(user)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete User
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem disabled>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete unavailable
                </DropdownMenuItem>
                <div className="px-2.5 py-2 text-xs text-text-muted">
                  {user.deleteBlockedReason || 'This account cannot be deleted from this page.'}
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">All Users</h1>
          <p className="text-text-secondary">{totalUsers} registered users</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreateStudentDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Student
          </Button>
          <Button variant="outline" onClick={() => { setShowBulkImport(true); setBulkResults(null); setBulkCsv('') }}>
            <Upload className="h-4 w-4 mr-2" />
            Import Users
          </Button>
        </div>
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

      <Dialog
        open={showStudentDialog}
        onOpenChange={(open) => {
          setShowStudentDialog(open)
          if (!open) {
            resetStudentForm()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedStudent ? 'Edit Student' : 'Add Student'}</DialogTitle>
            <DialogDescription>
              {selectedStudent
                ? 'Update student details. Supervisor and admin management stays on the dedicated surfaces.'
                : 'Create a student account from the admin users page.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="student-first-name">First name</Label>
              <Input
                id="student-first-name"
                value={studentForm.firstName}
                onChange={(event) => setStudentForm((current) => ({ ...current, firstName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-last-name">Last name</Label>
              <Input
                id="student-last-name"
                value={studentForm.lastName}
                onChange={(event) => setStudentForm((current) => ({ ...current, lastName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-email">Email</Label>
              <Input
                id="student-email"
                type="email"
                value={studentForm.email}
                onChange={(event) => setStudentForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>University</Label>
              <Select
                value={studentForm.universityId}
                onValueChange={(value) => setStudentForm((current) => ({ ...current, universityId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select university" />
                </SelectTrigger>
                <SelectContent>
                  {universities.map((university) => (
                    <SelectItem key={university.id} value={university.id}>
                      {university.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStudentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveStudent()} disabled={savingStudent}>
              {savingStudent ? 'Saving...' : selectedStudent ? 'Save Changes' : 'Add Student'}
            </Button>
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
        open={statusTarget !== null}
        onOpenChange={(open) => {
          if (!open) setStatusTarget(null)
        }}
        title={statusTarget?.isActive ? 'Deactivate Student' : 'Reactivate Student'}
        description={
          statusTarget
            ? `${statusTarget.isActive ? 'Deactivate' : 'Reactivate'} ${statusTarget.firstName} ${statusTarget.lastName}?`
            : ''
        }
        confirmLabel={statusTarget?.isActive ? 'Deactivate' : 'Reactivate'}
        variant={statusTarget?.isActive ? 'destructive' : 'default'}
        loading={actionLoading === statusTarget?.id}
        onConfirm={() => {
          if (statusTarget) void executeStatusChange(statusTarget)
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Delete User"
        description="Are you sure you want to delete this user? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        loading={actionLoading === deleteTarget?.id}
        onConfirm={() => {
          if (deleteTarget) void executeDeleteUser(deleteTarget)
        }}
      />

      <Dialog open={showBulkImport} onOpenChange={setShowBulkImport}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Import Users</DialogTitle>
            <DialogDescription>
              Paste CSV rows below. Format: <code className="text-xs bg-muted px-1 rounded">email, firstName, lastName, role, universityName, password(optional)</code>
              <br />
              Role must be <strong>STUDENT</strong> or <strong>SUPERVISOR</strong>. Default password is <strong>RevMe@2025!</strong> if omitted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>CSV Data</Label>
            <Textarea
              className="font-mono h-52 text-xs"
              placeholder={`email,firstName,lastName,role,universityName\njohn@uni.edu,John,Doe,STUDENT,University of Nashville\njane@uni.edu,Jane,Smith,SUPERVISOR,University of Nashville`}
              value={bulkCsv}
              onChange={(e) => setBulkCsv(e.target.value)}
            />
            {bulkResults && (
              <div className="rounded-lg border border-border p-3 text-sm space-y-1">
                <p className="font-medium">Import Results</p>
                <p className="text-success">✓ {bulkResults.created} users created</p>
                <p className="text-text-secondary">→ {bulkResults.skipped} skipped (already exist)</p>
                {bulkResults.errors > 0 && <p className="text-error">✗ {bulkResults.errors} errors</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkImport(false)}>Cancel</Button>
            <Button onClick={() => void handleBulkImport()} disabled={bulkImporting || !bulkCsv.trim()}>
              {bulkImporting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing...</> : <><Upload className="h-4 w-4 mr-2" />Import</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
