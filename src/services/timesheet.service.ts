import { prisma } from '../lib/db'
import { createError } from '../lib/api-response'
import { UserRole, type Prisma } from '@prisma/client'
import type { CreateTimeEntryInput, TimesheetQueryInput } from '../validations/timesheet'

export async function getTimeEntries(requesterId: string, requesterRole: UserRole, query: TimesheetQueryInput) {
  const targetUserId = requesterRole === UserRole.MEMBER ? requesterId : (query.userId ?? requesterId)

  const where: Prisma.TimeEntryWhereInput = {
    userId: targetUserId,
    deletedAt: null,
    ...(query.taskId && { taskId: query.taskId }),
    ...(query.projectId && { task: { projectId: query.projectId } }),
  }

  if (query.weekStart) {
    const start = new Date(query.weekStart)
    const end = new Date(start.getTime() + 7 * 86400000)
    where.date = { gte: start, lt: end }
  }

  return prisma.timeEntry.findMany({
    where,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true, date: true, hours: true, description: true, createdAt: true,
      user: { select: { id: true, name: true } },
      task: { select: { id: true, title: true, project: { select: { id: true, name: true } } } },
    },
  })
}

export async function logTime(data: CreateTimeEntryInput, userId: string) {
  const task = await prisma.task.findUnique({ where: { id: data.taskId, deletedAt: null }, select: { id: true } })
  if (!task) throw createError('Task not found', 404)

  return prisma.timeEntry.create({
    data: {
      taskId: data.taskId,
      userId,
      date: data.date,
      hours: data.hours,
      description: data.description,
    },
    select: {
      id: true, date: true, hours: true, description: true, createdAt: true,
      user: { select: { id: true, name: true } },
      task: { select: { id: true, title: true, project: { select: { id: true, name: true } } } },
    },
  })
}

export async function deleteTimeEntry(id: string, requesterId: string, requesterRole: UserRole) {
  const entry = await prisma.timeEntry.findUnique({ where: { id, deletedAt: null } })
  if (!entry) throw createError('Time entry not found', 404)

  const isAdmin = requesterRole === UserRole.ADMIN
  if (!isAdmin && entry.userId !== requesterId) throw createError('Access denied', 403)

  await prisma.timeEntry.update({ where: { id }, data: { deletedAt: new Date() } })
}
