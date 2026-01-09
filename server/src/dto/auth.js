import { z } from 'zod'

export const signupSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(8),
})

export const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(8),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
})

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1),
  password: z.string().min(8),
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
