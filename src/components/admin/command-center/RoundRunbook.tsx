import Link from 'next/link'
import { ArrowRight, CheckCircle2, CircleDashed, LockKeyhole } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardData } from './command-center-types'

const STATUS_ICON = {
  done: CheckCircle2,
  pending: CircleDashed,
  blocked: LockKeyhole,
}

export function RoundRunbook({ rounds }: { rounds: DashboardData['runbook'] }) {
  if (rounds.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>This Round</CardTitle><CardDescription>Create or activate a season to see the operations runbook.</CardDescription></CardHeader>
        <CardContent><Link href="/admin/season" className="inline-flex min-h-11 items-center font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Manage seasons <ArrowRight className="ml-2 h-4 w-4" /></Link></CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>This Round</CardTitle>
        <CardDescription>Automatic milestones and the next faculty actions, in order.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 xl:grid-cols-2">
        {rounds.map((round) => (
          <section key={round.id} aria-labelledby={`runbook-${round.id}`}>
            <h3 id={`runbook-${round.id}`} className="mb-3 font-display text-lg font-semibold">{round.timing === 'current' ? 'Current' : 'Next'} · Round {round.number}</h3>
            <ol className="space-y-1">
              {round.items.map((item) => {
                const Icon = STATUS_ICON[item.status]
                return <li key={item.key}><Link href={item.href} className="group flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-surface-secondary"><Icon aria-hidden="true" className={`h-5 w-5 shrink-0 ${item.status === 'done' ? 'text-success' : item.status === 'blocked' ? 'text-text-muted' : 'text-warning'}`} /><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-foreground">{item.label}</span><span className="block truncate text-xs text-text-secondary">{item.detail}</span></span><span className="sr-only">Status: {item.status}.</span><ArrowRight aria-hidden="true" className="h-4 w-4 text-text-muted transition-transform group-hover:translate-x-0.5" /></Link></li>
              })}
            </ol>
          </section>
        ))}
      </CardContent>
    </Card>
  )
}
