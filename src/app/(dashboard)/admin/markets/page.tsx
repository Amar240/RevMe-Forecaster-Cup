'use client'

import { useCallback, useEffect, useState } from 'react'
import { MapPin, Plus } from 'lucide-react'
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

interface Market {
  id: string
  name: string
  createdAt: string
}

export default function AdminMarketsPage() {
  const { loading: permLoading, isAdmin, hasFullAccess } = usePermissions()
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const res = await csrfFetch('/api/admin/markets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create market')
      }

      setName('')
      toast.success(`Added ${data.market.name}`)
      await fetchMarkets()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create market'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
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
            <CardTitle>Add Market</CardTitle>
            <CardDescription>Create a global market that can be selected during season setup.</CardDescription>
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
              <Button type="submit" disabled={saving}>
                <Plus className="mr-2 h-4 w-4" />
                {saving ? 'Adding...' : 'Add Market'}
              </Button>
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
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                  >
                    <div className="rounded-lg bg-primary-soft p-2 text-primary">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{market.name}</p>
                      <p className="text-xs text-text-muted">Global market</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
