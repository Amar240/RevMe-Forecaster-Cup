import { z } from 'zod'

export const listUsersQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(100).default(50),
})

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>
