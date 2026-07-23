'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Edit, GraduationCap, Loader2, MoreVertical, Plus, RefreshCw, Shield } from 'lucide-react'
import { clientLogger } from '@/lib/client-logger'
import { csrfFetch } from '@/lib/csrf'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { CardSkeleton, TableSkeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface StudentUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: 'STUDENT'
  isActive: boolean
  createdAt: string
  teamMemberships: { id: string; isSubmitter: boolean; team: { id: string; name: string; displayId: string } }[]
}

export default function SupervisorStudentsPage() {
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<StudentUser[]>([])
  const [canManage, setCanManage] = useState(true)
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null)
  const [universityName, setUniversityName] = useState<string | null>(null)
  const [selectedStudent, setSelectedStudent] = useState<StudentUser | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [statusTarget, setStatusTarget] = useState<StudentUser | null>(null)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
  })

  const fetchStudents = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/supervisor/students')
      const data = await res.json() as {
        students?: StudentUser[]
        total?: number
        canManage?: boolean
        message?: string
        universityName?: string | null
      }

      if (!res.ok) {
        throw new Error(data.message || 'Failed to load students')
      }

      setStudents(data.students || [])
      setCanManage(data.canManage ?? true)
      setBlockedMessage(data.message ?? null)
      setUniversityName(data.universityName ?? null)
    } catch (error) {
      clientLogger.error('Failed to fetch supervisor students:', error)
      setStudents([])
      setCanManage(false)
      setUniversityName(null)
      setBlockedMessage(
        error instanceof Error
          ? error.message
          : 'You do not have permission to manage students.'
      )
      toast.error(error instanceof Error ? error.message : 'Failed to load students')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStudents()
  }, [fetchStudents])

  const resetForm = () => {
    setSelectedStudent(null)
    setForm({
      firstName: '',
      lastName: '',
      email: '',
    })
  }

  const openCreateDialog = () => {
    resetForm()
    setShowDialog(true)
  }

  const openEditDialog = (student: StudentUser) => {
    setSelectedStudent(student)
    setForm({
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      toast.error('All fields are required')
      return
    }

    setSaving(true)
    try {
      const url = selectedStudent ? `/api/supervisor/students/${selectedStudent.id}` : '/api/supervisor/students'
      const method = selectedStudent ? 'PATCH' : 'POST'

      const res = await csrfFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json() as { emailSent?: boolean; message?: string }

      if (!res.ok) {
        throw new Error(data.message || 'Failed to save student')
      }

      toast.success(
        selectedStudent
          ? 'Student updated successfully'
          : data.emailSent
          ? 'Student created and password reset email sent'
          : 'Student created. Password reset email could not be sent.'
      )

      resetForm()
      setShowDialog(false)
      await fetchStudents()
    } catch (error) {
      clientLogger.error('Failed to save student:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save student')
    } finally {
      setSaving(false)
    }
  }

  const executeStatusChange = async (student: StudentUser) => {
    setActionLoading(student.id)
    try {
      const res = await csrfFetch(`/api/supervisor/students/${student.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !student.isActive }),
      })
      const data = await res.json() as { message?: string }
      if (!res.ok) throw new Error(data.message || 'Failed to update student status')

      toast.success(student.isActive ? 'Student deactivated' : 'Student reactivated')
      await fetchStudents()
    } catch (error) {
      clientLogger.error('Failed to update student status:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update student status')
    } finally {
      setActionLoading(null)
      setStatusTarget(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded bg-surface-secondary" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-24 animate-pulse rounded bg-surface-secondary" />
          </CardHeader>
          <CardContent>
            <TableSkeleton rows={5} columns={5} />
          </CardContent>
        </Card>
      </div>
    )
  }

  const activeStudents = students.filter((student) => student.isActive)
  const inactiveStudents = students.filter((student) => !student.isActive)

  const columns = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (student: StudentUser) => (
        <span className="font-medium text-foreground">{student.firstName} {student.lastName}</span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: (student: StudentUser) => <span className="text-text-secondary">{student.email}</span>,
    },
    {
      key: 'isActive',
      header: 'Status',
      sortable: true,
      render: (student: StudentUser) => (
        <Badge variant={student.isActive ? 'success' : 'neutral'}>
          {student.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'team',
      header: 'Team',
      render: (student: StudentUser) => (
        <span className="text-text-secondary">{student.teamMemberships[0]?.team.name || '-'}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (student: StudentUser) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={actionLoading === student.id || !canManage}>
              {actionLoading === student.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEditDialog(student)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Student
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusTarget(student)}>
              <Shield className="mr-2 h-4 w-4" />
              {student.isActive ? 'Deactivate Student' : 'Reactivate Student'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Students</h1>
          <p className="text-text-secondary">
            {universityName ? `Manage students at ${universityName}` : 'Manage students in your university'}
          </p>
        </div>
        <Button onClick={openCreateDialog} disabled={!canManage}>
          <Plus className="mr-2 h-4 w-4" />
          Add Student
        </Button>
      </div>

      {!canManage && blockedMessage && (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-text-secondary">{blockedMessage}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card variant="metric" className="bg-gradient-to-br from-surface-secondary to-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm font-medium text-text-secondary">
              <GraduationCap className="mr-2 h-4 w-4 text-foreground" />
              Total Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">{students.length}</p>
          </CardContent>
        </Card>
        <Card variant="metric" className="border-success/10 bg-gradient-to-br from-success-background to-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm font-medium text-text-secondary">
              <Shield className="mr-2 h-4 w-4 text-success" />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-success">{activeStudents.length}</p>
          </CardContent>
        </Card>
        <Card variant="metric" className="border-warning/10 bg-gradient-to-br from-warning-background to-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm font-medium text-text-secondary">
              <Shield className="mr-2 h-4 w-4 text-warning" />
              Inactive
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-warning">{inactiveStudents.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={students}
            columns={columns}
            searchKeys={['firstName', 'lastName', 'email']}
            searchPlaceholder="Search by name or email..."
            pageSize={20}
            filters={[
              {
                key: 'isActive',
                label: 'Status',
                options: [
                  { value: 'true', label: 'Active' },
                  { value: 'false', label: 'Inactive' },
                ],
              },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedStudent ? 'Edit Student' : 'Add Student'}</DialogTitle>
            <DialogDescription>
              {selectedStudent
                ? 'Update student details. University stays locked to your account.'
                : 'Create a student in your university. The student will receive a password reset email to set their password.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sup-student-first-name">First Name</Label>
                <Input
                  id="sup-student-first-name"
                  value={form.firstName}
                  onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sup-student-last-name">Last Name</Label>
                <Input
                  id="sup-student-last-name"
                  value={form.lastName}
                  onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                  disabled={saving}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-student-email">Email</Label>
              <Input
                id="sup-student-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>University</Label>
              <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-text-secondary">
                {universityName || 'Your assigned university'}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving || !canManage}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : selectedStudent ? (
                'Save Changes'
              ) : (
                'Add Student'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={statusTarget !== null}
        onOpenChange={(open) => {
          if (!open) setStatusTarget(null)
        }}
        title={statusTarget?.isActive ? 'Deactivate Student' : 'Reactivate Student'}
        description={
          statusTarget?.isActive
            ? `Deactivate ${statusTarget?.firstName} ${statusTarget?.lastName}? Their team history will remain intact, but they will not be able to sign in.`
            : `Reactivate ${statusTarget?.firstName} ${statusTarget?.lastName}? They will be able to sign in again right away.`
        }
        confirmLabel={statusTarget?.isActive ? 'Deactivate' : 'Reactivate'}
        variant={statusTarget?.isActive ? 'destructive' : 'default'}
        loading={actionLoading === statusTarget?.id}
        onConfirm={() => {
          if (statusTarget) void executeStatusChange(statusTarget)
        }}
      />
    </div>
  )
}
