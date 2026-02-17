import { z } from 'zod'

export const createSeasonSchema = z.object({
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string().optional(),
})

export type CreateSeasonInput = z.infer<typeof createSeasonSchema>
