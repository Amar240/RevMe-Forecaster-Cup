type TeamRosterStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'ARCHIVED'
  | 'REJECTED'
  | 'DISQUALIFIED'

const managedStatuses = new Set<TeamRosterStatus>(['PENDING_APPROVAL', 'APPROVED', 'ACTIVE'])

export function formatPersonOptionLabel(person: {
  firstName?: string | null
  lastName?: string | null
  email: string
}) {
  const fullName = [person.firstName, person.lastName].filter(Boolean).join(' ').trim()
  return fullName ? `${fullName} (${person.email})` : person.email
}

export function isRosterBlockedStatus(status: string | null | undefined) {
  return status === 'ARCHIVED' || status === 'REJECTED' || status === 'DISQUALIFIED'
}

export function getRosterRestrictionMessage(status: string | null | undefined) {
  switch (status) {
    case 'ARCHIVED':
      return 'Member changes are unavailable while this team is archived.'
    case 'REJECTED':
      return 'Member changes are unavailable while this team is rejected.'
    case 'DISQUALIFIED':
      return 'Member changes are unavailable while this team is disqualified.'
    default:
      return ''
  }
}

export function getMinimumRosterRequirementMessage(status: string | null | undefined, memberCount: number) {
  if (memberCount !== 1 || !managedStatuses.has(status as TeamRosterStatus)) {
    return ''
  }

  return 'This team must keep at least one member in its current status.'
}
