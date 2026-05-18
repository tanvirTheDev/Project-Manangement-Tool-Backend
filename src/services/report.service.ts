import { Prisma } from '@prisma/client'
import { prisma } from '../lib/db'
import { createError } from '../lib/api-response'
import { UserRole } from '@prisma/client'
import type { UtilizationQuery, VelocityQuery, ProjectSummaryQuery } from '../validations/reports'

function weekLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function addWeeks(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n * 7)
  return d
}

function buildWeeks(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => addWeeks(start, i))
}

// ── Team Utilization ────────────────────────────────────────────────────────

interface RawUtilRow {
  userId: string
  userName: string
  avatar: string | null
  weekStart: Date
  hours: number
}

export async function getTeamUtilization(query: UtilizationQuery, requesterRole: UserRole) {
  if (requesterRole !== UserRole.ADMIN && requesterRole !== UserRole.MANAGER) {
    throw createError('Forbidden', 403)
  }

  const periodStart = query.weekStart
  const periodEnd = addWeeks(periodStart, query.weekCount)
  const weeks = buildWeeks(periodStart, query.weekCount)
  const weekLabels = weeks.map(weekLabel)

  const userFilter = query.userId
    ? Prisma.sql`AND te."userId" = ${query.userId}::uuid`
    : Prisma.empty

  // $queryRaw with Prisma.sql for dynamic filter — avoids N+1
  const rows = await prisma.$queryRaw<RawUtilRow[]>(Prisma.sql`
    SELECT
      u.id                                                      AS "userId",
      u.name                                                    AS "userName",
      u.avatar                                                  AS avatar,
      DATE_TRUNC('week', te.date::timestamp AT TIME ZONE 'UTC') AS "weekStart",
      SUM(te.hours)::float                                      AS hours
    FROM "TimeEntry" te
    JOIN "User" u ON te."userId" = u.id
    WHERE te."deletedAt" IS NULL
      AND te.date >= ${periodStart}::date
      AND te.date <  ${periodEnd}::date
      ${userFilter}
    GROUP BY u.id, u.name, u.avatar,
             DATE_TRUNC('week', te.date::timestamp AT TIME ZONE 'UTC')
    ORDER BY u.name, "weekStart"
  `)

  const userMap = new Map<string, {
    userId: string; userName: string; avatar: string | null; weekMap: Map<string, number>
  }>()

  for (const row of rows) {
    if (!userMap.has(row.userId)) {
      userMap.set(row.userId, { userId: row.userId, userName: row.userName, avatar: row.avatar, weekMap: new Map() })
    }
    const label = weekLabel(new Date(row.weekStart))
    userMap.get(row.userId)!.weekMap.set(label, row.hours)
  }

  const data = Array.from(userMap.values()).map(({ userId, userName, avatar, weekMap }) => {
    const weekHours = weekLabels.map((label) => ({ weekLabel: label, hours: weekMap.get(label) ?? 0 }))
    const totalHours = weekHours.reduce((s, w) => s + w.hours, 0)
    return { userId, userName, avatar, weeks: weekHours, totalHours, averageHoursPerWeek: totalHours / query.weekCount }
  })

  return {
    data,
    meta: { weeks: weekLabels, periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() },
  }
}

// ── Task Velocity ────────────────────────────────────────────────────────────

interface RawCountRow { weekStart: Date; count: bigint }

export async function getTaskVelocity(query: VelocityQuery, requesterId: string, requesterRole: UserRole) {
  if (requesterRole !== UserRole.ADMIN && requesterRole !== UserRole.MANAGER) {
    throw createError('Forbidden', 403)
  }

  const now = new Date()
  const periodStart = addWeeks(now, -query.weekCount)
  const weeks = buildWeeks(periodStart, query.weekCount)

  // Resolve project scope
  let projectFilter: Prisma.Sql = Prisma.empty
  if (query.projectId) {
    projectFilter = Prisma.sql`AND t."projectId" = ${query.projectId}::uuid`
  } else if (requesterRole === UserRole.MANAGER) {
    const memberships = await prisma.projectMember.findMany({
      where: { userId: requesterId },
      select: { projectId: true },
    })
    if (memberships.length > 0) {
      const ids = memberships.map((m) => m.projectId)
      projectFilter = Prisma.sql`AND t."projectId" = ANY(${ids}::uuid[])`
    }
  }

  const [completedRows, createdRows] = await Promise.all([
    prisma.$queryRaw<RawCountRow[]>(Prisma.sql`
      SELECT
        DATE_TRUNC('week', al."createdAt" AT TIME ZONE 'UTC') AS "weekStart",
        COUNT(DISTINCT al."taskId")                           AS count
      FROM "ActivityLog" al
      JOIN "Task" t ON al."taskId" = t.id
      WHERE al.action    = 'STATUS_CHANGED'
        AND al."newValue" = 'DONE'
        AND al."createdAt" >= ${periodStart}
        AND t."deletedAt" IS NULL
        ${projectFilter}
      GROUP BY DATE_TRUNC('week', al."createdAt" AT TIME ZONE 'UTC')
      ORDER BY "weekStart"
    `),
    prisma.$queryRaw<RawCountRow[]>(Prisma.sql`
      SELECT
        DATE_TRUNC('week', t."createdAt" AT TIME ZONE 'UTC') AS "weekStart",
        COUNT(*)                                              AS count
      FROM "Task" t
      WHERE t."createdAt" >= ${periodStart}
        AND t."deletedAt" IS NULL
        ${projectFilter}
      GROUP BY DATE_TRUNC('week', t."createdAt" AT TIME ZONE 'UTC')
      ORDER BY "weekStart"
    `),
  ])

  const completedMap = new Map(completedRows.map((r) => [weekLabel(new Date(r.weekStart)), Number(r.count)]))
  const createdMap = new Map(createdRows.map((r) => [weekLabel(new Date(r.weekStart)), Number(r.count)]))

  const data = weeks.map((w) => {
    const label = weekLabel(w)
    const completed = completedMap.get(label) ?? 0
    const created = createdMap.get(label) ?? 0
    return { weekLabel: label, weekStart: w.toISOString(), completed, created, netVelocity: completed - created }
  })

  const totalCompleted = data.reduce((s, d) => s + d.completed, 0)
  return { data, meta: { totalCompleted, averagePerWeek: totalCompleted / query.weekCount } }
}

// ── Project Summary ──────────────────────────────────────────────────────────

export async function getProjectSummary(query: ProjectSummaryQuery, requesterRole: UserRole) {
  if (requesterRole !== UserRole.ADMIN) {
    throw createError('Only ADMIN can view project summary', 403)
  }

  const clients = await prisma.client.findMany({
    where: { deletedAt: null, ...(query.clientId ? { id: query.clientId } : {}) },
    include: {
      projects: {
        where: { deletedAt: null },
        include: {
          tasks: { where: { deletedAt: null }, select: { id: true, status: true } },
          invoices: {
            where: { deletedAt: null, status: { in: ['SENT', 'PAID'] } },
            select: { totalAmount: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  const allProjectIds = clients.flatMap((c) => c.projects.map((p) => p.id))

  if (allProjectIds.length === 0) return { data: [] }

  // Hours per task then mapped to project
  const timeRows = await prisma.timeEntry.groupBy({
    by: ['taskId'],
    where: {
      deletedAt: null,
      ...(query.dateFrom ? { date: { gte: query.dateFrom } } : {}),
      ...(query.dateTo ? { date: { lte: query.dateTo } } : {}),
      task: { projectId: { in: allProjectIds }, deletedAt: null },
    },
    _sum: { hours: true },
  })

  const taskProjectMap = new Map<string, string>()
  for (const client of clients) {
    for (const project of client.projects) {
      for (const task of project.tasks) taskProjectMap.set(task.id, project.id)
    }
  }

  const projectHoursMap = new Map<string, number>()
  for (const row of timeRows) {
    const pid = taskProjectMap.get(row.taskId)
    if (pid) projectHoursMap.set(pid, (projectHoursMap.get(pid) ?? 0) + Number(row._sum.hours ?? 0))
  }

  const data = clients.map((client) => {
    const projects = client.projects.map((project) => {
      const totalHours = projectHoursMap.get(project.id) ?? 0
      const totalInvoiced = project.invoices.reduce((s, inv) => s + Number(inv.totalAmount), 0)
      const taskCounts = {
        todo: project.tasks.filter((t) => t.status === 'TODO').length,
        inProgress: project.tasks.filter((t) => t.status === 'IN_PROGRESS').length,
        inReview: project.tasks.filter((t) => t.status === 'IN_REVIEW').length,
        done: project.tasks.filter((t) => t.status === 'DONE').length,
      }
      const total = Object.values(taskCounts).reduce((s, n) => s + n, 0)
      return {
        projectId: project.id,
        projectName: project.name,
        totalHours,
        totalInvoiced,
        taskCounts,
        completionRate: total > 0 ? (taskCounts.done / total) * 100 : 0,
      }
    })
    return {
      clientId: client.id,
      clientName: client.name,
      projects,
      clientTotalHours: projects.reduce((s, p) => s + p.totalHours, 0),
      clientTotalInvoiced: projects.reduce((s, p) => s + p.totalInvoiced, 0),
    }
  })

  return { data }
}
