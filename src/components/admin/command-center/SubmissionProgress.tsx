import { Card, CardContent } from '@/components/ui/card'
import type { DashboardData } from './command-center-types'

export interface SubmissionProgressProps {
  stats: Pick<DashboardData['stats'], 'totalSubmissions' | 'totalWarnings' | 'scoredSubmissions'>
  meta: Pick<DashboardData['meta'], 'expectedErrors'>
  submissionProgress: DashboardData['submissionProgress']
}

export function SubmissionProgress({ stats, meta, submissionProgress }: SubmissionProgressProps) {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="border-gray-200">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500">Submissions</div>
            <div className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              Live
            </div>
          </div>
          <div className="mt-3 text-2xl font-semibold text-gray-900 tabular-nums">
            {stats.totalSubmissions}
          </div>
          <div className="mt-4 h-2 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-blue-500"
              style={{ width: `${Math.min(100, (stats.totalSubmissions || 0) * 5)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500">Warnings</div>
            <div className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              Live
            </div>
          </div>
          <div className="mt-3 text-2xl font-semibold text-gray-900 tabular-nums">
            {stats.totalWarnings}
          </div>
          <div className="mt-4 h-2 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-amber-500"
              style={{ width: `${Math.min(100, (stats.totalWarnings || 0) * 5)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500">Scoring integrity</div>
            <div className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              Live
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm text-gray-600">
            <div className="flex items-center justify-between">
              <span title="Processed errors = scored submissions available for scoring.">
                Processed Errors
              </span>
              <span className="font-semibold text-gray-900 tabular-nums">
                {stats.scoredSubmissions}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span title={meta.expectedErrors === null ? 'Data not available' : undefined}>
                Expected Errors
              </span>
              <span
                className={`font-semibold tabular-nums ${meta.expectedErrors === null ? 'text-gray-400' : 'text-gray-900'}`}
              >
                {meta.expectedErrors === null ? 'Not set' : meta.expectedErrors}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Teams Submitted</span>
              <span className="font-semibold text-gray-900 tabular-nums">
                {submissionProgress.submitted} / {submissionProgress.total}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
