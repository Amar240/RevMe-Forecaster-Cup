'use client'

import { useEffect, useState } from 'react'
import { Bot, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { getImportAssistStatus, updateImportAssistMode, type ImportAssistStatus } from '@/features/season/api'

export function ImportAssistControl({ seasonId }: { seasonId: string }) {
  const [status, setStatus] = useState<ImportAssistStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => { void getImportAssistStatus(seasonId).then(setStatus).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not load AI settings')).finally(() => setLoading(false)) }, [seasonId])
  const change = async (mode: 'DISABLED' | 'ON_DEMAND') => { setLoading(true); try { setStatus(await updateImportAssistMode(seasonId, mode)); toast.success(mode === 'ON_DEMAND' ? 'On-demand import assistance enabled' : 'Import assistance disabled') } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update AI settings') } finally { setLoading(false); setConfirm(false) } }
  return <><Card><CardHeader><CardTitle className="flex items-center gap-2 font-display"><Bot className="h-5 w-5 text-primary"/>Roster import AI assistance</CardTitle><CardDescription>Supervisors must request help explicitly. Deterministic validation remains authoritative.</CardDescription></CardHeader><CardContent>{loading && !status ? <Loader2 className="h-5 w-5 animate-spin text-primary"/> : status && <div className="space-y-4"><div className="flex flex-wrap gap-2"><Badge variant={status.infrastructureAvailable ? 'success' : 'neutral'}>Infrastructure {status.infrastructureAvailable ? 'available' : 'off'}</Badge><Badge variant={status.effective ? 'info' : 'neutral'}>Season {status.mode === 'ON_DEMAND' ? 'on demand' : 'disabled'}</Badge></div><p className="break-all font-mono text-xs text-text-secondary">{status.model}</p><div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><Stat label="Calls" value={status.usage.calls}/><Stat label="Tokens" value={status.usage.inputTokens + status.usage.outputTokens}/><Stat label="Accepted" value={status.usage.accepted}/><Stat label="Rejected" value={status.usage.rejected}/></div>{status.mode === 'DISABLED' ? <Button disabled={loading || !status.infrastructureAvailable} onClick={() => setConfirm(true)}>Enable on demand</Button> : <Button variant="outline" disabled={loading} onClick={() => void change('DISABLED')}>Disable assistance</Button>}{!status.infrastructureAvailable && <p className="text-sm text-text-secondary">Set BEDROCK_IMPORT_ASSIST=true and configure the deployment IAM role before enabling this season.</p>}</div>}</CardContent></Card><ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Enable AI roster assistance?" description="Supervisors may choose to send the minimum relevant roster cells to Amazon Bedrock for mapping, explanations, or repair suggestions. AI never validates or imports data, and every proposed edit requires supervisor approval." confirmLabel="Enable on demand" loading={loading} onConfirm={() => change('ON_DEMAND')}/></>
}
function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-md border border-border bg-surface-secondary p-3"><p className="text-text-secondary">{label}</p><p className="font-mono text-lg font-semibold tabular-nums">{value}</p></div> }
