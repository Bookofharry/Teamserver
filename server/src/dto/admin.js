import { z } from 'zod'

export const updateAdminUserPlanSchema = z.object({
  plan: z.string().trim().min(1, 'Valid plan is required'),
})
