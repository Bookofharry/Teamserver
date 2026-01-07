import { z } from 'zod'
import { parseOutput } from '../../utils/validation.js'

const groupResponseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  color: z.string().optional(),
  noteCount: z.number(),
})

const deleteGroupResponseSchema = z.object({
  id: z.string(),
})

export const toGroupResponse = (data) => parseOutput(groupResponseSchema, data)
export const toDeleteGroupResponse = (data) => parseOutput(deleteGroupResponseSchema, data)
