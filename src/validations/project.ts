import { z } from 'zod'
import { ProjectStatus } from '@prisma/client'

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(300),
  description: z.string().optional(),
  clientId: z.string().uuid('Invalid client ID').optional(),
  leadId: z.string().uuid('Lead is required'),
  status: z.nativeEnum(ProjectStatus).default('PLANNING'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
})

export const updateProjectSchema = createProjectSchema.partial()

export const addMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
})

export const listProjectsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  clientId: z.string().uuid().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type AddMemberInput = z.infer<typeof addMemberSchema>
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>
