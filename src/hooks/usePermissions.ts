import { useEffect, useState, useCallback } from 'react'
import { csrfFetch } from '@/lib/csrf'

export function usePermissions() {
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasFullAccess, setHasFullAccess] = useState(false)

  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const res = await csrfFetch('/api/auth/permissions')
        if (res.ok) {
          const data = await res.json()
          setPermissions(data.permissions || [])
          setHasAccess(data.hasAccess || false)
          setIsAdmin(data.isAdmin || false)
          setHasFullAccess(data.hasFullAccess || false)
        }
      } catch {
      } finally {
        setLoading(false)
      }
    }

    loadPermissions()
  }, [])

  const canPerform = useCallback((permission: string) => {
    if (!hasAccess) return false
    if (isAdmin || hasFullAccess) return true
    if (permissions.includes('all')) return true
    return permissions.includes(permission)
  }, [hasAccess, isAdmin, hasFullAccess, permissions])

  return {
    loading,
    hasAccess,
    isAdmin,
    hasFullAccess,
    permissions,
    canPerform,
  }
}
