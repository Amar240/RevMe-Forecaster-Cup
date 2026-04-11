import { z } from 'zod'

export const createSeasonSchema = z.object({
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string().optional(),
  totalRounds: z.number().int().min(1).max(20).default(7),
  daysPerRound: z.number().int().min(1).max(30).optional(),
  marketIds: z.array(z.string()).min(1).max(10),
})

export type CreateSeasonInput = z.infer<typeof createSeasonSchema>
