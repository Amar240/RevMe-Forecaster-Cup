import { z } from 'zod'

export const registrationProfileSchema = z.object({
  role: z.enum(['STUDENT', 'SUPERVISOR']),
  universitySelectionMode: z.enum(['EXISTING', 'OTHER']).default('EXISTING'),
  universityId: z.string().trim().min(1).optional(),
  universityName: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional(),
}).superRefine((data, ctx) => {
  if (data.universitySelectionMode === 'EXISTING' && !data.universityId) ctx.addIssue({ code: 'custom', path: ['universityId'], message: 'University is required' })
  if (data.universitySelectionMode === 'OTHER' && !data.universityName) ctx.addIssue({ code: 'custom', path: ['universityName'], message: 'University name is required' })
  if (data.universitySelectionMode === 'OTHER' && !data.country) ctx.addIssue({ code: 'custom', path: ['country'], message: 'Country is required' })
})

export const registerSchema = z.intersection(z.object({
  email: z.string().trim().email(), password: z.string().min(8), firstName: z.string().trim().min(1), lastName: z.string().trim().min(1),
}), registrationProfileSchema)
