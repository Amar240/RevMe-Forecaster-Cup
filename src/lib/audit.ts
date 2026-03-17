import { prisma } from './db'
import { Prisma } from '@prisma/client'
import { logger } from './logger'

interface AuditActor {
  id?: string | null
  email?: string | null
  role?: string | null
}

interface AuditChangePayload {
  details?: Record<string, unknown> | null
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
}

function toJsonValue(value: Record<string, unknown> | null | undefined) {
  return value ? (value as Prisma.InputJsonValue) : Prisma.JsonNull
}

export function buildAuditLogData(
  actor: AuditActor | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  payload?: AuditChangePayload
) {
  return {
    userId: actor?.id ?? null,
    userEmail: actor?.email ?? null,
    userRole: actor?.role ?? null,
    action,
    entityType,
    entityId: entityId || null,
    details: toJsonValue(payload?.details),
    beforeJson: toJsonValue(payload?.before),
    afterJson: toJsonValue(payload?.after),
    ipAddress: payload?.ipAddress ?? null,
    userAgent: payload?.userAgent ?? null,
    requestId: payload?.requestId ?? null,
  }
}

export async function logAuditAction(
  userId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: Record<string, unknown> | null,
  ipAddress?: string | null
) {
  try {
    const actor = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, role: true },
        })
      : null

    const detailRecord = details ?? null
    const before =
      detailRecord && typeof detailRecord.before === 'object' && detailRecord.before !== null
        ? (detailRecord.before as Record<string, unknown>)
        : null
    const after =
      detailRecord && typeof detailRecord.after === 'object' && detailRecord.after !== null
        ? (detailRecord.after as Record<string, unknown>)
        : null

    await prisma.auditLog.create({
      data: buildAuditLogData(actor, action, entityType, entityId, {
        details: detailRecord,
        before,
        after,
        ipAddress,
      }),
    })
  } catch (error) {
    logger.error('Failed to log audit action', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
