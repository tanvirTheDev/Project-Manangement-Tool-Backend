import { z } from 'zod'

export const UserRoleEnum = z.enum(['ADMIN', 'MANAGER', 'MEMBER'])

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(50).optional().nullable(),
  bio: z.string().max(1000).optional().nullable(),
  designation: z.string().max(200).optional().nullable(),
  department: z.string().max(200).optional().nullable(),
  avatarUrl: z.string().url('Invalid URL').optional().nullable(),
})

export const changeRoleSchema = z.object({
  role: UserRoleEnum,
})

export const changeStatusSchema = z.object({
  isActive: z.boolean(),
})

export const listUsersQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  role: UserRoleEnum.optional(),
  department: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>
