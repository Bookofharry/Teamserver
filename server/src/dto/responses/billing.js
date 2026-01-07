import { z } from 'zod'
import { parseOutput } from '../../utils/validation.js'

const upgradeIntentResponseSchema = z.object({
  id: z.string(),
  plan: z.string(),
  status: z.string(),
  createdAt: z.string().optional(),
  alreadyPending: z.boolean().optional(),
})

export const toUpgradeIntentResponse = (data) => parseOutput(upgradeIntentResponseSchema, data)
