import { prisma } from './db'
import { Prisma } from '@prisma/client'
import { logger } from './logger'

export async function logAuditAction(
  userId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: Record<string, unknown> | null,
  ipAddress?: string | null
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId: entityId || null,
        details: details ? (details as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress: ipAddress || null,
      },
    })
  } catch (error) {
    logger.error('Failed to log audit action', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
