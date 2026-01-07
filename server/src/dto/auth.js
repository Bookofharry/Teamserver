import { z } from 'zod'

export const createSessionSchema = z
  .object({
    accessToken: z.string().trim().optional(),
    token: z.string().trim().optional(),
  })
  .refine((data) => data.accessToken || data.token, {
    message: 'accessToken is required',
  })

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    avatar: z.string().trim().optional(),
  })
  .refine((data) => data.name !== undefined || data.avatar !== undefined, {
    message: 'No fields to update',
  })

export const checkEmailSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
})
