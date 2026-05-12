import { z } from 'zod'
import { TaskStatus, Priority } from '@prisma/client'

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().optional(),
  assigneeId: z.string().uuid().optional(),
  priority: z.nativeEnum(Priority).default('MEDIUM'),
  dueDate: z.coerce.date().optional(),
  status: z.nativeEnum(TaskStatus).default('TODO'),
})

export const updateTaskSchema = createTaskSchema.partial().extend({
  position: z.number().int().optional(),
})

export const taskFiltersSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  assigneeId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
export type TaskFiltersInput = z.infer<typeof taskFiltersSchema>
