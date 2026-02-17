export interface TicketReply {
  id: string
  message: string
  createdAt: string
  author: { firstName: string; lastName: string; role: string }
}

export interface TicketSummary {
  id: string
  category: string
  subject: string
  message: string
  status: string
  createdAt: string
  createdBy: { firstName: string; lastName: string; email: string; role: string }
  supervisor: { firstName: string; lastName: string; email: string } | null
  assignedTo: { firstName: string; lastName: string } | null
  feedbackRating: boolean | null
  feedbackSubmittedAt: string | null
  replies: TicketReply[]
}

export interface SupervisorInfo {
  id: string
  firstName: string
  lastName: string
  email: string
}

export interface TicketsResponse {
  tickets: TicketSummary[]
}

export interface TicketResponse {
  ticket: TicketSummary
}

export interface SupervisorResponse {
  supervisor: SupervisorInfo | null
}
