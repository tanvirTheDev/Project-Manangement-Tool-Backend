import { z } from 'zod'
import { MilestoneStatus } from '@prisma/client'

export const createMilestoneSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.nativeEnum(MilestoneStatus).default('UPCOMING'),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date(),
})

export const updateMilestoneSchema = createMilestoneSchema.partial()

export const addTasksToMilestoneSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(50),
})

export const listMilestonesQuerySchema = z.object({
  status: z.nativeEnum(MilestoneStatus).optional(),
  includeArchived: z.coerce.boolean().default(false),
})

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>
export type ListMilestonesQuery = z.infer<typeof listMilestonesQuerySchema>
