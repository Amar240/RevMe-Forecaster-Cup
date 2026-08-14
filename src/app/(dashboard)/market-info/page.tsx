'use client'

import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Loader2,
  MapPin,
  ExternalLink,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { resourceTypeMeta } from '@/lib/status-metadata'

interface ResourceLink {
  id: string
  label: string
  url: string
  type: string
  note: string | null
}

interface RoundUpdate {
  id: string
  marketId: string
  roundNumber: number
  headline: string
  whatChanged: string
}

interface MarketInfo {
  id: string
  marketId?: string
  title: string | null
  summary: string | null
  description: string | null
  demandDrivers: string[]
  supplyNotes: string[]
  risks: string[]
  strategyHints: string[]
  resourceLinks: ResourceLink[]
  market: { id: string; name: string }
  updatedAt: string
}

interface Market {
  id: string
  name: string
}

export default function MarketInfoPage() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [marketInfos, setMarketInfos] = useState<MarketInfo[]>([])
  const [roundUpdates, setRoundUpdates] = useState<RoundUpdate[]>([])
  const [currentRound, setCurrentRound] = useState<{ number: number } | null>(null)
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [season, setSeason] = useState<{ id: string; name: string } | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/market-info')
      if (res.ok) {
        const data = await res.json()
        setMarkets(data.markets || [])
        setMarketInfos(data.marketInfos || [])
        setRoundUpdates(data.currentRoundUpdates || [])
        setCurrentRound(data.currentRound)
        setSeason(data.season)
        if (data.markets?.length > 0 && !selectedMarketId) {
          setSelectedMarketId(data.markets[0].id)
        }
      }
    } catch (err) {
      clientLogger.error('Failed to fetch data:', err)
      toast.error('Failed to load market information')
    } finally {
      setLoading(false)
    }
  }, [selectedMarketId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const fetchMarketDetail = async (marketId: string) => {
    try {
      const res = await csrfFetch(`/api/market-info?marketId=${marketId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.marketInfo) {
          setMarketInfos((prev) => {
            const existing = prev.findIndex((item) => item.id === data.marketInfo.id)
            if (existing >= 0) {
              const updated = [...prev]
              updated[existing] = data.marketInfo
              return updated
            }
            return [...prev, data.marketInfo]
          })
        }
        if (data.currentRoundUpdate) {
          setRoundUpdates((prev) => {
            const existing = prev.findIndex((item) => item.marketId === marketId)
            if (existing >= 0) {
              const updated = [...prev]
              updated[existing] = { ...data.currentRoundUpdate, marketId }
              return updated
            }
            return [...prev, { ...data.currentRoundUpdate, marketId }]
          })
        }
      }
    } catch (err) {
      clientLogger.error('Failed to fetch market detail:', err)
      toast.error('Failed to load market details')
    }
  }

  useEffect(() => {
    if (selectedMarketId) {
      fetchMarketDetail(selectedMarketId)
    }
  }, [selectedMarketId])

  const selectedInfo = marketInfos.find((item) => item.market?.id === selectedMarketId || item.marketId === selectedMarketId)
  const selectedMarket = markets.find((market) => market.id === selectedMarketId)
  const currentRoundUpdate = roundUpdates.find((update) => update.marketId === selectedMarketId)

  const getMarketTone = (name: string) => {
    if (name.includes('Nashville')) {
      return {
        surface: 'border-primary/20 bg-primary-soft/55 text-primary',
        title: 'text-primary',
      }
    }
    if (name.includes('Dubai')) {
      return {
        surface: 'border-accent/20 bg-accent-soft/60 text-accent',
        title: 'text-accent',
      }
    }
    if (name.includes('Hamburg')) {
      return {
        surface: 'border-info/20 bg-info-background/60 text-info',
        title: 'text-info',
      }
    }
    return {
      surface: 'border-border bg-surface-secondary text-text-secondary',
      title: 'text-foreground',
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (markets.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Market Information" description="Context and insights about the markets you are forecasting" />
        <Card>
          <CardContent className="p-0">
            <EmptyState icon={<MapPin className="h-7 w-7" />} title="No Markets Available" description="Market information will be available when a season is active." />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Market Information"
        description={
          <>
            Context and insights for {season?.name || 'current season'}
            {currentRound && <span className="ml-2 text-primary">(Round {currentRound.number})</span>}
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        {markets.map((market) => {
          const tone = getMarketTone(market.name)
          const hasInfo = marketInfos.some((item) => item.market?.id === market.id || item.marketId === market.id)
          const isSelected = selectedMarketId === market.id

          return (
            <Button
              key={market.id}
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedMarketId(market.id)}
              className={!isSelected && hasInfo ? tone.surface : ''}
            >
              <MapPin className="mr-1 h-4 w-4" />
              {market.name}
              {hasInfo && !isSelected && <ChevronRight className="ml-1 h-3 w-3" />}
            </Button>
          )
        })}
      </div>

      {selectedMarket && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {currentRoundUpdate && (
              <Card className="border-warning/20 bg-warning-background/45">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-warning">
                    <TrendingUp className="h-5 w-5" />
                    What Changed This Round
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-1 font-medium text-foreground">{currentRoundUpdate.headline}</p>
                  <p className="text-text-secondary">{currentRoundUpdate.whatChanged}</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className={`h-5 w-5 ${getMarketTone(selectedMarket.name).title}`} />
                  {selectedMarket.name}
                </CardTitle>
                {selectedInfo?.title && <CardDescription className="text-base">{selectedInfo.title}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-6">
                {selectedInfo?.summary && (
                  <div className="rounded-lg border border-info/20 bg-info-background/55 p-4 text-text-secondary">
                    {selectedInfo.summary}
                  </div>
                )}

                {selectedInfo?.description && (
                  <div>
                    <h4 className="mb-2 font-medium text-foreground">Overview</h4>
                    <p className="whitespace-pre-wrap text-text-secondary">{selectedInfo.description}</p>
                  </div>
                )}

                {!selectedInfo && (
                  <div className="py-8 text-center text-text-secondary">
                    <MapPin className="mx-auto mb-2 h-8 w-8 text-text-muted" />
                    <p>No detailed information available for this market yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedInfo && (selectedInfo.demandDrivers?.length > 0 || selectedInfo.supplyNotes?.length > 0) && (
              <div className="grid gap-4 md:grid-cols-2">
                {selectedInfo.demandDrivers?.length > 0 && (
                  <Card className="border-success/20 bg-success-background/35">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base text-success">
                        <TrendingUp className="h-4 w-4" />
                        Demand Drivers
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selectedInfo.demandDrivers.map((driver, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-text-secondary">
                            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success" />
                            {driver}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {selectedInfo.supplyNotes?.length > 0 && (
                  <Card className="border-info/20 bg-info-background/35">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base text-info">
                        <TrendingDown className="h-4 w-4" />
                        Supply Notes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selectedInfo.supplyNotes.map((note, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-text-secondary">
                            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-info" />
                            {note}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {selectedInfo && (selectedInfo.risks?.length > 0 || selectedInfo.strategyHints?.length > 0) && (
              <div className="grid gap-4 md:grid-cols-2">
                {selectedInfo.risks?.length > 0 && (
                  <Card className="border-warning/20 bg-warning-background/35">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base text-warning">
                        <AlertTriangle className="h-4 w-4" />
                        Risks to Consider
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selectedInfo.risks.map((risk, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-text-secondary">
                            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-warning" />
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {selectedInfo.strategyHints?.length > 0 && (
                  <Card className="border-accent/20 bg-accent-soft/35">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base text-accent">
                        <Lightbulb className="h-4 w-4" />
                        Strategy Hints
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selectedInfo.strategyHints.map((hint, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-text-secondary">
                            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                            {hint}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {selectedInfo?.resourceLinks && selectedInfo.resourceLinks.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" />
                    Resources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedInfo.resourceLinks.map((link) => {
                      const tone = resourceTypeMeta[link.type as keyof typeof resourceTypeMeta] || resourceTypeMeta.LINK

                      return (
                        <a
                          key={link.id}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block rounded-lg border border-border p-3 transition-colors hover:bg-muted"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="flex items-center gap-1 font-medium text-primary group-hover:text-primary-hover">
                                {link.label}
                                <ArrowUpRight className="h-3 w-3" />
                              </p>
                              <div className="mt-1 flex items-center gap-2">
                                <Badge variant={tone.tone}>{tone.label}</Badge>
                                {link.note && <span className="text-xs text-text-muted">{link.note}</span>}
                              </div>
                            </div>
                            <ExternalLink className="h-4 w-4 text-text-muted group-hover:text-primary" />
                          </div>
                        </a>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedInfo && (
              <div className="text-center text-xs text-text-muted">
                Last updated {new Date(selectedInfo.updatedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
