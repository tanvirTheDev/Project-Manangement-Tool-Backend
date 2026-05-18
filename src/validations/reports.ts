import { z } from 'zod'

export const utilizationQuerySchema = z.object({
  weekStart: z.coerce.date(),
  weekCount: z.coerce.number().min(1).max(26).default(8),
  userId: z.string().uuid().optional(),
})

export const velocityQuerySchema = z.object({
  weekCount: z.coerce.number().min(1).max(26).default(8),
  projectId: z.string().uuid().optional(),
})

export const projectSummaryQuerySchema = z.object({
  clientId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})

export type UtilizationQuery = z.infer<typeof utilizationQuerySchema>
export type VelocityQuery = z.infer<typeof velocityQuerySchema>
export type ProjectSummaryQuery = z.infer<typeof projectSummaryQuerySchema>
