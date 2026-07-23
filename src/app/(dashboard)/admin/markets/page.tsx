'use client'

import { useCallback, useEffect, useState } from 'react'
import { Edit, MapPin, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { usePermissions } from '@/hooks/usePermissions'
import { AccessDenied } from '@/components/ui/access-denied'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertBanner } from '@/components/ui/alert-banner'
import { PageLoader } from '@/components/ui/page-loader'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface Market {
  id: string
  name: string
  createdAt: string
  isLocked: boolean
  lockReason: string | null
}

export default function AdminMarketsPage() {
  const { loading: permLoading, isAdmin, hasFullAccess } = usePermissions()
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [editingTarget, setEditingTarget] = useState<Market | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Market | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const hasMarketAccess = isAdmin || hasFullAccess

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/markets')
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to load markets')
      }

      setMarkets(data.markets || [])
    } catch (err) {
      clientLogger.error('Failed to fetch markets:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to load markets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!permLoading && hasMarketAccess) {
      void fetchMarkets()
    }
  }, [fetchMarkets, hasMarketAccess, permLoading])

  const resetForm = useCallback(() => {
    setEditingTarget(null)
    setName('')
    setError('')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const res = await csrfFetch(
        editingTarget ? `/api/admin/markets/${editingTarget.id}` : '/api/admin/markets',
        {
          method: editingTarget ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        }
      )
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || `Failed to ${editingTarget ? 'update' : 'create'} market`)
      }

      resetForm()
      toast.success(editingTarget ? `Saved ${data.market.name}` : `Added ${data.market.name}`)
      await fetchMarkets()
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to ${editingTarget ? 'update' : 'create'} market`
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (market: Market) => {
    setEditingTarget(market)
    setName(market.name)
    setError('')
  }

  const executeDelete = async (market: Market) => {
    setActionLoading(true)
    try {
      const res = await csrfFetch(`/api/admin/markets/${market.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete market')
      }

      if (editingTarget?.id === market.id) {
        resetForm()
      }

      setDeleteTarget(null)
      toast.success(data.message || `Deleted ${market.name}`)
      await fetchMarkets()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete market'
      toast.error(message)
    } finally {
      setActionLoading(false)
    }
  }

  if (permLoading || loading) {
    return <PageLoader message="Loading markets..." />
  }

  if (!hasMarketAccess) {
    return (
      <AccessDenied
        title="Access Denied"
        message="You do not have permission to manage markets. Contact your administrator if you need access."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Markets</h1>
        <p className="text-text-secondary">Manage the global market catalog used when creating seasons.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{editingTarget ? 'Edit Market' : 'Add Market'}</CardTitle>
            <CardDescription>
              {editingTarget
                ? 'Update the market name before it is used by a started season.'
                : 'Create a global market that can be selected during season setup.'}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}
              <div className="space-y-2">
                <Label htmlFor="market-name">Market Name</Label>
                <Input
                  id="market-name"
                  placeholder="e.g., Nashville CBD"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  <Plus className="mr-2 h-4 w-4" />
                  {saving ? (editingTarget ? 'Saving...' : 'Adding...') : (editingTarget ? 'Save Changes' : 'Add Market')}
                </Button>
                {editingTarget ? (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Markets</CardTitle>
            <CardDescription>These markets become available the next time an admin creates a season.</CardDescription>
          </CardHeader>
          <CardContent>
            {markets.length === 0 ? (
              <AlertBanner variant="info" title="No markets yet">
                Create your first market to make season setup available.
              </AlertBanner>
            ) : (
              <div className="space-y-3">
                {markets.map((market) => (
                  <div
                    key={market.id}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary-soft p-2 text-primary">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{market.name}</p>
                          {market.isLocked ? <Badge variant="warning">Locked</Badge> : null}
                        </div>
                        <p className="text-xs text-text-muted">Global market</p>
                        {market.isLocked ? (
                          <p className="text-xs text-text-muted">{market.lockReason ?? 'Used in a started season'}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(market)}
                        disabled={market.isLocked}
                        title={market.isLocked ? market.lockReason ?? 'Used in a started season' : 'Edit market'}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(market)}
                        disabled={market.isLocked}
                        className="text-error hover:bg-error-background hover:text-error"
                        title={market.isLocked ? market.lockReason ?? 'Used in a started season' : 'Delete market'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title="Delete Market"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.name}? This removes it from the global market catalog.`
            : 'Delete this market from the global market catalog.'
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={actionLoading}
        onConfirm={() => {
          if (deleteTarget) {
            void executeDelete(deleteTarget)
          }
        }}
      />
    </div>
  )
}
