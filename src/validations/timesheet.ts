import { z } from 'zod'

export const createTimeEntrySchema = z.object({
  taskId: z.string().uuid(),
  date: z.coerce.date(),
  hours: z.number().min(0.25).max(24),
  description: z.string().max(500).optional(),
})

export const timesheetQuerySchema = z.object({
  weekStart: z.coerce.date().optional(),
  userId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
})

export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>
export type TimesheetQueryInput = z.infer<typeof timesheetQuerySchema>
