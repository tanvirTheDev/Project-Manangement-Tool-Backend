import { prisma } from '../lib/db'
import { TaskStatus, UserRole } from '@prisma/client'

function getWeekRange(offset = 0): { start: Date; end: Date } {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = (day === 0 ? -6 : 1 - day) + offset * 7
  const start = new Date(now)
  start.setDate(now.getDate() + diffToMonday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  return { start, end }
}

export async function getAdminStats() {
  const thisWeek = getWeekRange(0)
  const lastWeek = getWeekRange(-1)

  const [
    totalActiveProjects,
    totalClients,
    totalTeamMembers,
    tasksCompletedThisWeek,
    tasksCompletedLastWeek,
    overdueTasksCount,
    activeProjects,
  ] = await Promise.all([
    prisma.project.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    prisma.client.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { isActive: true, deletedAt: null } }),
    prisma.task.count({
      where: { status: TaskStatus.DONE, deletedAt: null, updatedAt: { gte: thisWeek.start, lt: thisWeek.end } },
    }),
    prisma.task.count({
      where: { status: TaskStatus.DONE, deletedAt: null, updatedAt: { gte: lastWeek.start, lt: lastWeek.end } },
    }),
    prisma.task.count({
      where: { dueDate: { lt: new Date() }, status: { not: TaskStatus.DONE }, deletedAt: null },
    }),
    prisma.project.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, status: true,
        client: { select: { name: true } },
        lead: { select: { name: true, avatar: true } },
        _count: { select: { tasks: { where: { deletedAt: null } } } },
        tasks: {
          where: { deletedAt: null },
          select: { status: true },
        },
      },
    }),
  ])

  const projectHealth = activeProjects.map((p) => {
    const total = p.tasks.length
    const done = p.tasks.filter((t) => t.status === TaskStatus.DONE).length
    const progressPercentage = total === 0 ? 0 : Math.round((done / total) * 100)
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      clientName: p.client?.name ?? null,
      progressPercentage,
      leadName: p.lead.name,
      leadAvatar: p.lead.avatar,
    }
  })

  return {
    totalActiveProjects,
    totalClients,
    totalTeamMembers,
    tasksCompletedThisWeek,
    tasksCompletedLastWeek,
    overdueTasksCount,
    projectHealth,
  }
}

export async function getManagerStats(userId: string) {
  const projectIds = (
    await prisma.project.findMany({
      where: {
        deletedAt: null,
        OR: [{ leadId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true },
    })
  ).map((p) => p.id)

  const [projects, overdueTasks, breakdown] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: projectIds }, status: 'ACTIVE', deletedAt: null },
      select: {
        id: true, name: true, status: true,
        client: { select: { name: true } },
        tasks: { where: { deletedAt: null }, select: { status: true } },
      },
    }),
    prisma.task.findMany({
      where: {
        projectId: { in: projectIds },
        dueDate: { lt: new Date() },
        status: { not: TaskStatus.DONE },
        deletedAt: null,
      },
      take: 10,
      orderBy: { dueDate: 'asc' },
      select: {
        id: true, title: true, dueDate: true,
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
      },
    }),
    prisma.task.groupBy({
      by: ['status'],
      where: { projectId: { in: projectIds }, deletedAt: null },
      _count: { status: true },
    }),
  ])

  const myActiveProjects = projects.map((p) => {
    const total = p.tasks.length
    const done = p.tasks.filter((t) => t.status === TaskStatus.DONE).length
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      clientName: p.client?.name ?? null,
      progressPercentage: total === 0 ? 0 : Math.round((done / total) * 100),
      taskStatusBreakdown: {
        todo: p.tasks.filter((t) => t.status === 'TODO').length,
        inProgress: p.tasks.filter((t) => t.status === 'IN_PROGRESS').length,
        inReview: p.tasks.filter((t) => t.status === 'IN_REVIEW').length,
        done,
      },
    }
  })

  const teamTaskBreakdown = {
    todo: 0, inProgress: 0, inReview: 0, done: 0,
  }
  for (const g of breakdown) {
    if (g.status === 'TODO') teamTaskBreakdown.todo = g._count.status
    if (g.status === 'IN_PROGRESS') teamTaskBreakdown.inProgress = g._count.status
    if (g.status === 'IN_REVIEW') teamTaskBreakdown.inReview = g._count.status
    if (g.status === 'DONE') teamTaskBreakdown.done = g._count.status
  }

  const overdueTasksInMyProjects = overdueTasks.map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate,
    projectName: t.project.name,
    projectId: t.project.id,
    assigneeName: t.assignee?.name ?? null,
    assigneeAvatar: t.assignee?.avatar ?? null,
  }))

  return { myActiveProjects, overdueTasksInMyProjects, teamTaskBreakdown }
}

export async function getMemberStats(userId: string) {
  const thisWeek = getWeekRange(0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const [myOpenTasksCount, dueTodayCount, overdueCount, tasksCompletedThisWeek] = await Promise.all([
    prisma.task.count({
      where: { assigneeId: userId, status: { not: TaskStatus.DONE }, deletedAt: null },
    }),
    prisma.task.count({
      where: { assigneeId: userId, status: { not: TaskStatus.DONE }, deletedAt: null, dueDate: { gte: today, lt: tomorrow } },
    }),
    prisma.task.count({
      where: { assigneeId: userId, status: { not: TaskStatus.DONE }, deletedAt: null, dueDate: { lt: today } },
    }),
    prisma.task.count({
      where: { assigneeId: userId, status: TaskStatus.DONE, deletedAt: null, updatedAt: { gte: thisWeek.start, lt: thisWeek.end } },
    }),
  ])

  return { myOpenTasksCount, dueTodayCount, overdueCount, tasksCompletedThisWeek }
}

export async function getActivityFeed(userId: string, role: UserRole) {
  let taskWhere = {}

  if (role === UserRole.MANAGER) {
    const projectIds = (
      await prisma.project.findMany({
        where: { deletedAt: null, OR: [{ leadId: userId }, { members: { some: { userId } } }] },
        select: { id: true },
      })
    ).map((p) => p.id)
    taskWhere = { projectId: { in: projectIds } }
  } else if (role === UserRole.MEMBER) {
    taskWhere = { OR: [{ assigneeId: userId }, { reporterId: userId }] }
  }

  const logs = await prisma.activityLog.findMany({
    where: { task: { deletedAt: null, ...taskWhere } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true, action: true, oldValue: true, newValue: true, createdAt: true,
      user: { select: { id: true, name: true, avatar: true } },
      task: {
        select: {
          id: true, title: true,
          project: { select: { id: true, name: true } },
        },
      },
    },
  })

  return logs.map((l) => ({
    id: l.id,
    action: l.action,
    oldValue: l.oldValue,
    newValue: l.newValue,
    createdAt: l.createdAt,
    taskTitle: l.task.title,
    taskId: l.task.id,
    projectName: l.task.project.name,
    projectId: l.task.project.id,
    actorName: l.user.name,
    actorAvatar: l.user.avatar,
  }))
}
