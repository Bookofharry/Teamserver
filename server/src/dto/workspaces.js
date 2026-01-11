import { z } from 'zod'

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .max(15, 'name must be 15 characters or fewer')
    .regex(/^[A-Za-z ]*$/, 'name must use letters and spaces only')
    .optional()
    .default(''),
})

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'name is required')
    .max(15, 'name must be 15 characters or fewer')
    .regex(/^[A-Za-z ]+$/, 'name must use letters and spaces only'),
})

export const createInviteSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
  role: z.string().trim().optional(),
})
