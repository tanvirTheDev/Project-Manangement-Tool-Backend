import { prisma } from '../lib/db'
import { createError } from '../lib/api-response'
import { TaskStatus, Priority, UserRole, type Prisma } from '@prisma/client'
import { createNotification } from './notification.service'
import type { CreateTaskInput, UpdateTaskInput, TaskFiltersInput } from '../validations/task'

const taskSelect = {
  id: true, title: true, description: true, projectId: true,
  assigneeId: true, reporterId: true, status: true, priority: true,
  position: true, dueDate: true, createdAt: true, updatedAt: true, deletedAt: true,
  assignee: { select: { id: true, name: true, avatar: true } },
  reporter: { select: { id: true, name: true, avatar: true } },
  _count: { select: { comments: { where: { deletedAt: null } }, attachments: { where: { deletedAt: null } } } },
} as const

const taskDetailSelect = {
  ...taskSelect,
  comments: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true, content: true, createdAt: true, updatedAt: true, deletedAt: true,
      author: { select: { id: true, name: true, avatar: true } },
    },
  },
  attachments: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true, fileName: true, fileUrl: true, fileSize: true, mimeType: true,
      cloudinaryId: true, createdAt: true,
      uploadedBy: { select: { id: true, name: true } },
    },
  },
  activityLogs: {
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true, action: true, oldValue: true, newValue: true, createdAt: true,
      user: { select: { id: true, name: true, avatar: true } },
    },
  },
  timeEntries: {
    where: { deletedAt: null },
    orderBy: { date: 'desc' as const },
    select: {
      id: true, date: true, hours: true, description: true, createdAt: true,
      user: { select: { id: true, name: true } },
    },
  },
} as const

async function verifyMembership(projectId: string, userId: string, requesterRole: UserRole) {
  if (requesterRole !== UserRole.MEMBER) return
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  })
  if (!member) throw createError('Access denied', 403)
}

async function writeActivityLog(
  taskId: string,
  userId: string,
  action: string,
  oldValue?: string,
  newValue?: string
) {
  await prisma.activityLog.create({ data: { taskId, userId, action, oldValue, newValue } })
}

export async function getTasks(projectId: string, filters: TaskFiltersInput, requesterId: string, requesterRole: UserRole) {
  const project = await prisma.project.findUnique({ where: { id: projectId, deletedAt: null } })
  if (!project) throw createError('Project not found', 404)
  await verifyMembership(projectId, requesterId, requesterRole)

  const where: Prisma.TaskWhereInput = {
    projectId,
    deletedAt: null,
    ...(filters.status && { status: filters.status }),
    ...(filters.priority && { priority: filters.priority }),
    ...(filters.assigneeId && { assigneeId: filters.assigneeId }),
    ...(filters.dateFrom && { dueDate: { gte: filters.dateFrom } }),
    ...(filters.dateTo && { dueDate: { lte: filters.dateTo } }),
    ...(filters.cursor && { id: { gt: filters.cursor } }),
  }

  const tasks = await prisma.task.findMany({
    where,
    select: taskSelect,
    orderBy: [{ status: 'asc' }, { position: 'asc' }, { createdAt: 'desc' }],
    take: filters.limit + 1,
  })

  const hasMore = tasks.length > filters.limit
  const data = hasMore ? tasks.slice(0, filters.limit) : tasks
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined
  const total = await prisma.task.count({ where: { projectId, deletedAt: null } })

  return { tasks: data, nextCursor, total }
}

export async function getMyTasks(userId: string) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(startOfToday.getTime() + 86400000)
  const endOfWeek = new Date(startOfToday.getTime() + 7 * 86400000)

  const tasks = await prisma.task.findMany({
    where: { assigneeId: userId, deletedAt: null, status: { not: TaskStatus.DONE } },
    select: {
      ...taskSelect,
      project: { select: { id: true, name: true } },
    },
    orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
  })

  const overdue: typeof tasks = []
  const dueToday: typeof tasks = []
  const thisWeek: typeof tasks = []
  const later: typeof tasks = []
  const noDueDate: typeof tasks = []

  for (const t of tasks) {
    if (!t.dueDate) { noDueDate.push(t); continue }
    const d = new Date(t.dueDate)
    if (d < startOfToday) overdue.push(t)
    else if (d < endOfToday) dueToday.push(t)
    else if (d < endOfWeek) thisWeek.push(t)
    else later.push(t)
  }

  return { overdue, dueToday, thisWeek, later, noDueDate }
}

export async function getTaskById(id: string, requesterId: string, requesterRole: UserRole) {
  const task = await prisma.task.findUnique({ where: { id, deletedAt: null }, select: { projectId: true } })
  if (!task) throw createError('Task not found', 404)
  await verifyMembership(task.projectId, requesterId, requesterRole)

  const full = await prisma.task.findUnique({ where: { id }, select: taskDetailSelect })
  if (!full) throw createError('Task not found', 404)
  return full
}

export async function createTask(projectId: string, data: CreateTaskInput, reporterId: string, requesterRole: UserRole) {
  const project = await prisma.project.findUnique({ where: { id: projectId, deletedAt: null } })
  if (!project) throw createError('Project not found', 404)
  await verifyMembership(projectId, reporterId, requesterRole)

  if (data.assigneeId) {
    const assignee = await prisma.user.findUnique({ where: { id: data.assigneeId, deletedAt: null, isActive: true } })
    if (!assignee) throw createError('Assignee not found', 404)
  }

  const maxPos = await prisma.task.aggregate({
    where: { projectId, status: data.status ?? TaskStatus.TODO, deletedAt: null },
    _max: { position: true },
  })

  const task = await prisma.task.create({
    data: {
      title: data.title,
      description: data.description,
      projectId,
      assigneeId: data.assigneeId,
      reporterId,
      status: data.status ?? TaskStatus.TODO,
      priority: data.priority ?? Priority.MEDIUM,
      position: (maxPos._max.position ?? -1) + 1,
      dueDate: data.dueDate,
    },
    select: taskSelect,
  })

  await writeActivityLog(task.id, reporterId, 'TASK_CREATED')

  if (data.assigneeId && data.assigneeId !== reporterId) {
    const reporter = await prisma.user.findUnique({ where: { id: reporterId }, select: { name: true } })
    await createNotification({
      userId: data.assigneeId,
      type: 'TASK_ASSIGNED',
      message: `${reporter?.name ?? 'Someone'} assigned you "${task.title}"`,
      link: `/projects/${projectId}`,
    })
  }

  return task
}

export async function updateTask(
  id: string,
  data: UpdateTaskInput,
  requesterId: string,
  requesterRole: UserRole
) {
  const task = await prisma.task.findUnique({
    where: { id, deletedAt: null },
    select: { id: true, projectId: true, status: true, assigneeId: true, priority: true, reporterId: true, title: true },
  })
  if (!task) throw createError('Task not found', 404)
  await verifyMembership(task.projectId, requesterId, requesterRole)

  const logs: Promise<void>[] = []

  if (data.status !== undefined && data.status !== task.status) {
    logs.push(writeActivityLog(id, requesterId, 'STATUS_CHANGED', task.status, data.status))
    if (data.status === TaskStatus.DONE && task.reporterId !== requesterId) {
      const requester = await prisma.user.findUnique({ where: { id: requesterId }, select: { name: true } })
      logs.push(createNotification({
        userId: task.reporterId,
        type: 'TASK_DONE',
        message: `${requester?.name ?? 'Someone'} marked "${task.title}" as done`,
        link: `/projects/${task.projectId}`,
      }))
    }
  }

  if (data.assigneeId !== undefined && data.assigneeId !== task.assigneeId) {
    logs.push(writeActivityLog(id, requesterId, 'ASSIGNEE_CHANGED', task.assigneeId ?? 'none', data.assigneeId ?? 'none'))
    if (data.assigneeId && data.assigneeId !== requesterId) {
      const requester = await prisma.user.findUnique({ where: { id: requesterId }, select: { name: true } })
      logs.push(createNotification({
        userId: data.assigneeId,
        type: 'TASK_ASSIGNED',
        message: `${requester?.name ?? 'Someone'} assigned you "${task.title}"`,
        link: `/projects/${task.projectId}`,
      }))
    }
  }

  if (data.priority !== undefined && data.priority !== task.priority) {
    logs.push(writeActivityLog(id, requesterId, 'PRIORITY_CHANGED', task.priority, data.priority))
  }

  await Promise.all(logs)

  return prisma.task.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.position !== undefined && { position: data.position }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
    },
    select: taskSelect,
  })
}

export async function softDeleteTask(id: string, requesterId: string, requesterRole: UserRole) {
  const task = await prisma.task.findUnique({ where: { id, deletedAt: null }, select: { reporterId: true, projectId: true } })
  if (!task) throw createError('Task not found', 404)

  const isAdminOrManager = requesterRole === UserRole.ADMIN || requesterRole === UserRole.MANAGER
  if (!isAdminOrManager && task.reporterId !== requesterId) throw createError('Access denied', 403)

  await prisma.task.update({ where: { id }, data: { deletedAt: new Date() } })
}
