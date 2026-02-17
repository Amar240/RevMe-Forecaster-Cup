import { prisma } from './db'
import { User } from '@prisma/client'

export async function checkPermission(userId: string, permissionName: string): Promise<boolean> {
  const userPerm = await prisma.userPermission.findFirst({
    where: {
      userId,
      permission: { name: permissionName },
    },
  })
  return !!userPerm
}

export function hasAdminAccess(user: User | null): boolean {
  if (!user) return false
  if (user.role === 'ADMIN') return true
  if (user.role === 'SUB_ADMIN' && user.hasFullAccess) return true
  return false
}

export async function canPerformAdminAction(
  user: User | null,
  requiredPermission?: string
): Promise<boolean> {
  if (!user) return false
  
  if (user.role === 'ADMIN') return true
  
  if (user.role === 'SUB_ADMIN') {
    if (user.hasFullAccess) return true
    
    if (requiredPermission) {
      return await checkPermission(user.id, requiredPermission)
    }
  }
  
  return false
}
