import { prisma } from '../lib/db'
import { createError } from '../lib/api-response'
import { MilestoneStatus, UserRole } from '@prisma/client'
import type { CreateMilestoneInput, UpdateMilestoneInput, ListMilestonesQuery } from '../validations/milestone'

const taskSelect = {
  id: true, title: true, status: true, priority: true, dueDate: true,
  assignee: { select: { id: true, name: true, avatar: true } },
} as const

async function assertProjectAccess(projectId: string, requesterId: string, requesterRole: UserRole) {
  if (requesterRole === UserRole.ADMIN) return
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: requesterId } },
  })
  if (!membership) throw createError('Not a project member', 403)
}

async function assertManagerRole(requesterRole: UserRole) {
  if (requesterRole !== UserRole.ADMIN && requesterRole !== UserRole.MANAGER) {
    throw createError('Only ADMIN or MANAGER can perform this action', 403)
  }
}

export async function getMilestones(
  projectId: string,
  query: ListMilestonesQuery,
  requesterId: string,
  requesterRole: UserRole
) {
  await assertProjectAccess(projectId, requesterId, requesterRole)

  const where = {
    projectId,
    deletedAt: query.includeArchived ? undefined : null,
    ...(query.status ? { status: query.status } : {}),
  }

  const milestones = await prisma.milestone.findMany({
    where,
    orderBy: { dueDate: 'asc' },
    include: {
      _count: { select: { tasks: true } },
      tasks: {
        include: { task: { select: { status: true } } },
      },
    },
  })

  return milestones.map((m) => {
    const total = m.tasks.length
    const completed = m.tasks.filter((t) => t.task.status === 'DONE').length
    return { ...m, tasks: undefined, _count: undefined, totalTasks: total, completedTasks: completed }
  })
}

export async function getMilestoneById(
  milestoneId: string,
  requesterId: string,
  requesterRole: UserRole
) {
  const milestone = await prisma.milestone.findFirst({
    where: { id: milestoneId, deletedAt: null },
    include: {
      tasks: { include: { task: { select: taskSelect } } },
    },
  })
  if (!milestone) throw createError('Milestone not found', 404)
  await assertProjectAccess(milestone.projectId, requesterId, requesterRole)

  const total = milestone.tasks.length
  const completed = milestone.tasks.filter((t) => t.task.status === 'DONE').length

  return {
    ...milestone,
    totalTasks: total,
    completedTasks: completed,
    tasks: milestone.tasks.map((t) => t.task),
  }
}

export async function createMilestone(
  projectId: string,
  data: CreateMilestoneInput,
  requesterId: string,
  requesterRole: UserRole
) {
  await assertManagerRole(requesterRole)
  const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } })
  if (!project) throw createError('Project not found', 404)

  return prisma.milestone.create({
    data: { ...data, projectId },
  })
}

export async function updateMilestone(
  milestoneId: string,
  data: UpdateMilestoneInput,
  requesterRole: UserRole
) {
  await assertManagerRole(requesterRole)
  const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, deletedAt: null } })
  if (!milestone) throw createError('Milestone not found', 404)

  return prisma.milestone.update({ where: { id: milestoneId }, data })
}

export async function archiveMilestone(milestoneId: string, requesterRole: UserRole) {
  await assertManagerRole(requesterRole)
  const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, deletedAt: null } })
  if (!milestone) throw createError('Milestone not found', 404)

  return prisma.milestone.update({
    where: { id: milestoneId },
    data: { deletedAt: new Date(), status: MilestoneStatus.CANCELLED },
  })
}

export async function addTasksToMilestone(
  milestoneId: string,
  taskIds: string[],
  requesterRole: UserRole
) {
  await assertManagerRole(requesterRole)
  const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, deletedAt: null } })
  if (!milestone) throw createError('Milestone not found', 404)

  // Upsert — skip already-linked tasks
  await prisma.milestoneTask.createMany({
    data: taskIds.map((taskId) => ({ milestoneId, taskId })),
    skipDuplicates: true,
  })

  return prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { tasks: { include: { task: { select: taskSelect } } } },
  })
}

export async function removeTaskFromMilestone(
  milestoneId: string,
  taskId: string,
  requesterRole: UserRole
) {
  await assertManagerRole(requesterRole)
  // Hard delete on junction — no business data
  await prisma.milestoneTask.delete({
    where: { milestoneId_taskId: { milestoneId, taskId } },
  })
}

export async function getBurndownData(
  milestoneId: string,
  requesterId: string,
  requesterRole: UserRole
) {
  const milestone = await prisma.milestone.findFirst({
    where: { id: milestoneId, deletedAt: null },
    include: { tasks: { select: { taskId: true } } },
  })
  if (!milestone) throw createError('Milestone not found', 404)
  await assertProjectAccess(milestone.projectId, requesterId, requesterRole)

  const taskIds = milestone.tasks.map((t) => t.taskId)
  const totalTasks = taskIds.length

  if (totalTasks === 0) {
    return {
      idealLine: [],
      actualLine: [],
      totalTasks: 0,
      completedTasks: 0,
      remainingTasks: 0,
      startDate: milestone.startDate?.toISOString() ?? milestone.createdAt.toISOString(),
      dueDate: milestone.dueDate.toISOString(),
    }
  }

  const startDate = milestone.startDate ?? milestone.createdAt
  const endDate = new Date() < milestone.dueDate ? new Date() : milestone.dueDate
  const totalDays = Math.max(1, Math.ceil((milestone.dueDate.getTime() - startDate.getTime()) / 86400000))

  // Build ideal line
  const idealLine: { date: string; remaining: number }[] = []
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const remaining = Math.max(0, Math.round(totalTasks - (totalTasks * i) / totalDays))
    idealLine.push({ date: d.toISOString().split('T')[0], remaining })
  }

  // Fetch STATUS_CHANGED → DONE logs for milestone tasks, ordered by date
  const doneLogs = await prisma.activityLog.findMany({
    where: {
      taskId: { in: taskIds },
      action: 'STATUS_CHANGED',
      newValue: 'DONE',
      createdAt: { gte: startDate },
    },
    orderBy: { createdAt: 'asc' },
    select: { taskId: true, createdAt: true },
  })

  // Map: taskId → earliest DONE date (tasks can be re-opened, take first completion)
  const firstDoneMap = new Map<string, Date>()
  for (const log of doneLogs) {
    if (!firstDoneMap.has(log.taskId)) firstDoneMap.set(log.taskId, log.createdAt)
  }

  // Build actual line: count tasks remaining per day
  const actualLine: { date: string; remaining: number }[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const dayEnd = new Date(d)
    dayEnd.setHours(23, 59, 59, 999)
    const completedByDay = [...firstDoneMap.values()].filter((dt) => dt <= dayEnd).length
    actualLine.push({ date: d.toISOString().split('T')[0], remaining: totalTasks - completedByDay })
  }

  const completedTasks = firstDoneMap.size

  return {
    idealLine,
    actualLine,
    totalTasks,
    completedTasks,
    remainingTasks: totalTasks - completedTasks,
    startDate: startDate.toISOString(),
    dueDate: milestone.dueDate.toISOString(),
  }
}
