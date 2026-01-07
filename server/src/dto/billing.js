import { z } from 'zod'

export const createUpgradeIntentSchema = z.object({
  plan: z.string().trim().min(1, 'Valid plan is required'),
  source: z.string().trim().optional(),
})
