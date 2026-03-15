import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { DashboardData } from './command-center-types'

export interface SubmissionProgressProps {
  stats: Pick<DashboardData['stats'], 'totalSubmissions' | 'totalWarnings' | 'scoredSubmissions'>
  meta: Pick<DashboardData['meta'], 'expectedErrors'>
  submissionProgress: DashboardData['submissionProgress']
}

function ProgressBar({
  value,
  tone,
}: {
  value: number
  tone: 'primary' | 'warning' | 'success'
}) {
  const toneClass =
    tone === 'primary'
      ? 'bg-primary'
      : tone === 'warning'
        ? 'bg-warning'
        : 'bg-success'

  return (
    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-secondary">
      <div className={`h-full ${toneClass}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  )
}

export function SubmissionProgress({ stats, meta, submissionProgress }: SubmissionProgressProps) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card variant="metric">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-text-secondary">Submissions</div>
            <Badge variant="info">Live</Badge>
          </div>
          <div className="mt-3 text-2xl font-semibold tabular-nums text-foreground">
            {stats.totalSubmissions}
          </div>
          <ProgressBar value={(stats.totalSubmissions || 0) * 5} tone="primary" />
        </CardContent>
      </Card>

      <Card variant="metric">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-text-secondary">Warnings</div>
            <Badge variant="warning">Live</Badge>
          </div>
          <div className="mt-3 text-2xl font-semibold tabular-nums text-foreground">
            {stats.totalWarnings}
          </div>
          <ProgressBar value={(stats.totalWarnings || 0) * 5} tone="warning" />
        </CardContent>
      </Card>

      <Card variant="metric">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-text-secondary">Scoring integrity</div>
            <Badge variant="success">Live</Badge>
          </div>
          <div className="mt-4 space-y-2 text-sm text-text-secondary">
            <div className="flex items-center justify-between">
              <span title="Processed errors = scored submissions available for scoring.">
                Processed Errors
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {stats.scoredSubmissions}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span title={meta.expectedErrors === null ? 'Data not available' : undefined}>
                Expected Errors
              </span>
              <span
                className={`font-semibold tabular-nums ${meta.expectedErrors === null ? 'text-text-muted' : 'text-foreground'}`}
              >
                {meta.expectedErrors === null ? 'Not set' : meta.expectedErrors}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Teams Submitted</span>
              <span className="font-semibold text-foreground">
                {submissionProgress.submitted} / {submissionProgress.total}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
