import { prisma } from '../lib/db'
import { createError } from '../lib/api-response'
import { UserRole, type Prisma } from '@prisma/client'
import type { UpdateProfileInput, ChangeRoleInput, ChangeStatusInput, ListUsersQuery } from '../validations/user'

const publicSelect = {
  id: true, name: true, email: true, avatar: true, role: true,
  designation: true, department: true, isActive: true, createdAt: true,
} as const

const fullSelect = {
  ...publicSelect, phone: true, bio: true, lastLoginAt: true, updatedAt: true,
} as const

export async function getUsers(query: ListUsersQuery) {
  const { cursor, limit, search, role, department, isActive } = query

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
      ],
    }),
    ...(role && { role: role as UserRole }),
    ...(department && { department: { contains: department, mode: 'insensitive' } }),
    ...(isActive !== undefined && { isActive }),
    ...(cursor && { id: { gt: cursor } }),
  }

  const users = await prisma.user.findMany({
    where,
    select: fullSelect,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  })

  const hasMore = users.length > limit
  const data = hasMore ? users.slice(0, limit) : users
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined
  const total = await prisma.user.count({ where: { deletedAt: null } })

  return { users: data, nextCursor, total }
}

export async function getUserById(id: string, requesterId: string, requesterRole: UserRole) {
  const user = await prisma.user.findUnique({ where: { id, deletedAt: null }, select: fullSelect })
  if (!user) throw createError('User not found', 404)

  if (requesterRole === UserRole.MEMBER && requesterId !== id) {
    const { phone, bio, lastLoginAt, updatedAt, ...pub } = user
    void phone; void bio; void lastLoginAt; void updatedAt
    return pub
  }

  return user
}

export async function updateUser(
  id: string,
  data: UpdateProfileInput,
  requesterId: string,
  requesterRole: UserRole
) {
  if (requesterRole === UserRole.MEMBER && requesterId !== id) {
    throw createError('You can only update your own profile', 403)
  }

  const user = await prisma.user.findUnique({ where: { id, deletedAt: null } })
  if (!user) throw createError('User not found', 404)

  return prisma.user.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.bio !== undefined && { bio: data.bio }),
      ...(data.designation !== undefined && { designation: data.designation }),
      ...(data.department !== undefined && { department: data.department }),
      ...(data.avatarUrl !== undefined && { avatar: data.avatarUrl }),
    },
    select: fullSelect,
  })
}

export async function changeRole(id: string, data: ChangeRoleInput, requesterId: string) {
  if (id === requesterId) throw createError('You cannot change your own role', 400)
  const user = await prisma.user.findUnique({ where: { id, deletedAt: null } })
  if (!user) throw createError('User not found', 404)

  return prisma.user.update({
    where: { id },
    data: { role: data.role as UserRole },
    select: publicSelect,
  })
}

export async function changeStatus(id: string, data: ChangeStatusInput, requesterId: string) {
  if (id === requesterId) throw createError('You cannot deactivate your own account', 400)
  const user = await prisma.user.findUnique({ where: { id, deletedAt: null } })
  if (!user) throw createError('User not found', 404)

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: data.isActive },
    select: publicSelect,
  })

  if (!data.isActive) {
    await prisma.refreshToken.deleteMany({ where: { userId: id } })
  }

  return updated
}
