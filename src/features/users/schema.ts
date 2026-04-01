import { z } from 'zod'

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(1000).default(50),
  role: z.enum(['STUDENT', 'SUPERVISOR', 'SUB_ADMIN', 'ADMIN']).optional(),
})

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>
