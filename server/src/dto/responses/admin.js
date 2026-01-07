import { z } from 'zod'
import { parseOutput } from '../../utils/validation.js'

const planSchema = z.enum(['free', 'premium', 'premium_plus']).catch('free')

const adminUserResponseSchema = z.object({
  id: z.string(),
  email: z.string().nullable().optional(),
  full_name: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  plan: planSchema.optional(),
  is_subscribed: z.boolean().nullable().optional(),
  created_at: z.string().nullable().optional(),
})

export const toAdminUserResponse = (data) => parseOutput(adminUserResponseSchema, data)
