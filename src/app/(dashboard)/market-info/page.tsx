'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, MapPin, ExternalLink, FileText, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, ChevronRight, ArrowUpRight } from 'lucide-react'

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
            const existing = prev.findIndex((m) => m.id === data.marketInfo.id)
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
            const existing = prev.findIndex((u) => u.marketId === marketId)
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
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
    if (selectedMarketId) {
      fetchMarketDetail(selectedMarketId)
    }
  }, [selectedMarketId])

  const selectedInfo = marketInfos.find((m) => m.market?.id === selectedMarketId || m.marketId === selectedMarketId)
  const selectedMarket = markets.find((m) => m.id === selectedMarketId)
  const currentRoundUpdate = roundUpdates.find((u) => u.marketId === selectedMarketId)

  const getMarketColor = (name: string) => {
    if (name.includes('Nashville')) return { bg: 'bg-indigo-50', border: 'border-indigo-200', accent: 'text-indigo-600' }
    if (name.includes('Dubai')) return { bg: 'bg-amber-50', border: 'border-amber-200', accent: 'text-amber-600' }
    if (name.includes('Hamburg')) return { bg: 'bg-teal-50', border: 'border-teal-200', accent: 'text-teal-600' }
    return { bg: 'bg-gray-50', border: 'border-gray-200', accent: 'text-gray-600' }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (markets.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Market Information</h1>
          <p className="text-gray-600">Context and insights about the markets you are forecasting</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Markets Available</h3>
            <p className="text-gray-500">Market information will be available when a season is active</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Market Information</h1>
          <p className="text-gray-600">
            Context and insights for {season?.name || 'current season'}
            {currentRound && <span className="ml-2 text-blue-600">(Round {currentRound.number})</span>}
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {markets.map((market) => {
          const colors = getMarketColor(market.name)
          const hasInfo = marketInfos.some((m) => m.market?.id === market.id || m.marketId === market.id)
          const isSelected = selectedMarketId === market.id
          return (
            <Button
              key={market.id}
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedMarketId(market.id)}
              className={!isSelected && hasInfo ? `${colors.bg} ${colors.border}` : ''}
            >
              <MapPin className="h-4 w-4 mr-1" />
              {market.name}
              {hasInfo && !isSelected && <ChevronRight className="h-3 w-3 ml-1" />}
            </Button>
          )
        })}
      </div>

      {selectedMarket && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {currentRoundUpdate && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
                    <TrendingUp className="h-5 w-5" />
                    What Changed This Round
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium text-amber-800 mb-1">{currentRoundUpdate.headline}</p>
                  <p className="text-amber-700">{currentRoundUpdate.whatChanged}</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  {selectedMarket.name}
                </CardTitle>
                {selectedInfo?.title && <CardDescription className="text-base">{selectedInfo.title}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-6">
                {selectedInfo?.summary && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-blue-800">{selectedInfo.summary}</p>
                  </div>
                )}

                {selectedInfo?.description && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Overview</h4>
                    <p className="text-gray-600 whitespace-pre-wrap">{selectedInfo.description}</p>
                  </div>
                )}

                {!selectedInfo && (
                  <div className="text-center py-8 text-gray-500">
                    <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p>No detailed information available for this market yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedInfo && (selectedInfo.demandDrivers?.length > 0 || selectedInfo.supplyNotes?.length > 0) && (
              <div className="grid md:grid-cols-2 gap-4">
                {selectedInfo.demandDrivers?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2 text-green-700">
                        <TrendingUp className="h-4 w-4" />
                        Demand Drivers
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selectedInfo.demandDrivers.map((driver, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                            {driver}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {selectedInfo.supplyNotes?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2 text-blue-700">
                        <TrendingDown className="h-4 w-4" />
                        Supply Notes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selectedInfo.supplyNotes.map((note, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
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
              <div className="grid md:grid-cols-2 gap-4">
                {selectedInfo.risks?.length > 0 && (
                  <Card className="border-red-100">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2 text-red-700">
                        <AlertTriangle className="h-4 w-4" />
                        Risks to Consider
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selectedInfo.risks.map((risk, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {selectedInfo.strategyHints?.length > 0 && (
                  <Card className="border-purple-100">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2 text-purple-700">
                        <Lightbulb className="h-4 w-4" />
                        Strategy Hints
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selectedInfo.strategyHints.map((hint, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
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
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Resources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedInfo.resourceLinks.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 rounded-lg border hover:bg-gray-50 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-blue-600 group-hover:text-blue-700 flex items-center gap-1">
                              {link.label}
                              <ArrowUpRight className="h-3 w-3" />
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-500">
                                {link.type === 'DATA' ? 'Data' : link.type === 'DOCUMENT' ? 'Doc' : link.type === 'TUTORIAL' ? 'Tutorial' : 'Link'}
                              </span>
                              {link.note && <span className="text-xs text-gray-500">{link.note}</span>}
                            </div>
                          </div>
                          <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
                        </div>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedInfo && (
              <div className="text-xs text-gray-400 text-center">
                Last updated {new Date(selectedInfo.updatedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}




