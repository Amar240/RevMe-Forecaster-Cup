import { ActivityFeed } from './ActivityFeed'
import { OperationalQueues } from './OperationalQueues'
import type { DashboardData } from './command-center-types'

export function OperationsSection({
  submissionProgress,
  meta,
}: {
  submissionProgress: DashboardData['submissionProgress']
  meta: DashboardData['meta']
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <OperationalQueues submissionProgress={submissionProgress} meta={meta} />
      <ActivityFeed />
    </div>
  )
}
