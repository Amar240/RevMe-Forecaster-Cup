export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'medal'

export const teamStatusMeta = {
  DRAFT: { label: 'Draft', tone: 'neutral' as const },
  PENDING_APPROVAL: { label: 'Pending Approval', tone: 'warning' as const },
  APPROVED: { label: 'Approved', tone: 'info' as const },
  ACTIVE: { label: 'Active', tone: 'success' as const },
  REJECTED: { label: 'Rejected', tone: 'error' as const },
  DISQUALIFIED: { label: 'Disqualified', tone: 'error' as const },
}

export const actualMetricMeta = {
  OCCUPANCY: { label: 'Occupancy', tone: 'info' as const },
  ADR: { label: 'ADR', tone: 'medal' as const },
}

export const ticketStatusMeta = {
  OPEN: { label: 'Open', tone: 'warning' as const },
  WAITING_ON_SUPERVISOR: { label: 'Awaiting Supervisor', tone: 'warning' as const },
  WAITING_ON_STUDENT: { label: 'Waiting on Student', tone: 'info' as const },
  ESCALATED: { label: 'Escalated', tone: 'error' as const },
  RESOLVED: { label: 'Resolved', tone: 'success' as const },
}

export const resourceTypeMeta = {
  DATA: { label: 'Data', tone: 'info' as const },
  DOCUMENT: { label: 'Doc', tone: 'neutral' as const },
  TUTORIAL: { label: 'Tutorial', tone: 'medal' as const },
  LINK: { label: 'Link', tone: 'neutral' as const },
}
