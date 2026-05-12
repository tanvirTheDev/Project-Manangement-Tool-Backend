import { prisma } from '../lib/db'
import { createError } from '../lib/api-response'
import { ProjectStatus, UserRole, type Prisma } from '@prisma/client'
import { createNotification } from './notification.service'
import type { CreateProjectInput, UpdateProjectInput, ListProjectsQuery } from '../validations/project'

const memberSelect = {
  userId: true,
  joinedAt: true,
  user: { select: { id: true, name: true, avatar: true, role: true, designation: true } },
}

const projectSelect = {
  id: true, name: true, description: true, clientId: true, leadId: true,
  status: true, startDate: true, endDate: true, createdAt: true, updatedAt: true, deletedAt: true,
  client: { select: { id: true, name: true } },
  lead: { select: { id: true, name: true, avatar: true } },
  members: { select: memberSelect },
} as const

export async function calcProgress(projectId: string): Promise<number> {
  const [total, done] = await Promise.all([
    prisma.task.count({ where: { projectId, deletedAt: null } }),
    prisma.task.count({ where: { projectId, deletedAt: null, status: 'DONE' } }),
  ])
  if (total === 0) return 0
  return Math.round((done / total) * 100)
}

async function withProgress<T extends { id: string }>(project: T) {
  const progress = await calcProgress(project.id)
  return { ...project, progressPercentage: progress }
}

export async function getProjects(query: ListProjectsQuery, requesterId: string, requesterRole: UserRole) {
  const { search, status, clientId, cursor, limit } = query

  const memberFilter: Prisma.ProjectWhereInput =
    requesterRole === UserRole.MEMBER
      ? { members: { some: { userId: requesterId } } }
      : {}

  const where: Prisma.ProjectWhereInput = {
    deletedAt: null,
    ...memberFilter,
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    }),
    ...(status && { status }),
    ...(clientId && { clientId }),
    ...(cursor && { id: { gt: cursor } }),
  }

  const projects = await prisma.project.findMany({
    where,
    select: projectSelect,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  })

  const hasMore = projects.length > limit
  const data = hasMore ? projects.slice(0, limit) : projects
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined
  const total = await prisma.project.count({ where: { deletedAt: null, ...memberFilter } })

  const withProgressData = await Promise.all(data.map(withProgress))
  return { projects: withProgressData, nextCursor, total }
}

export async function getProjectById(id: string, requesterId: string, requesterRole: UserRole) {
  const project = await prisma.project.findUnique({ where: { id, deletedAt: null }, select: projectSelect })
  if (!project) throw createError('Project not found', 404)

  if (requesterRole === UserRole.MEMBER) {
    const isMember = project.members.some((m) => m.userId === requesterId)
    if (!isMember) throw createError('Access denied', 403)
  }

  return withProgress(project)
}

export async function createProject(data: CreateProjectInput) {
  if (data.clientId) {
    const client = await prisma.client.findUnique({ where: { id: data.clientId, deletedAt: null } })
    if (!client) throw createError('Client not found', 404)
  }

  const lead = await prisma.user.findUnique({ where: { id: data.leadId, deletedAt: null, isActive: true } })
  if (!lead) throw createError('Lead user not found', 404)

  const project = await prisma.project.create({
    data: {
      name: data.name,
      description: data.description,
      clientId: data.clientId,
      leadId: data.leadId,
      status: data.status ?? ProjectStatus.PLANNING,
      startDate: data.startDate,
      endDate: data.endDate,
    },
    select: projectSelect,
  })

  // Auto-add lead as member
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: data.leadId } },
    create: { projectId: project.id, userId: data.leadId },
    update: {},
  })

  return withProgress(project)
}

export async function updateProject(
  id: string,
  data: UpdateProjectInput,
  requesterId: string,
  requesterRole: UserRole
) {
  const project = await prisma.project.findUnique({ where: { id, deletedAt: null } })
  if (!project) throw createError('Project not found', 404)

  const isAdminOrManager = requesterRole === UserRole.ADMIN || requesterRole === UserRole.MANAGER
  const isLead = project.leadId === requesterId

  if (!isAdminOrManager && !isLead) throw createError('Access denied', 403)

  // Lead (non-admin/manager) can only update status
  if (!isAdminOrManager && isLead) {
    const allowedKeys = new Set(['status'])
    const attemptedKeys = Object.keys(data).filter((k) => data[k as keyof UpdateProjectInput] !== undefined)
    const unauthorized = attemptedKeys.filter((k) => !allowedKeys.has(k))
    if (unauthorized.length > 0) throw createError('Lead can only update project status', 403)
  }

  return prisma.project.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.clientId !== undefined && { clientId: data.clientId }),
      ...(data.leadId !== undefined && { leadId: data.leadId }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.startDate !== undefined && { startDate: data.startDate }),
      ...(data.endDate !== undefined && { endDate: data.endDate }),
    },
    select: projectSelect,
  })
}

export async function addMember(projectId: string, userId: string, requesterId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId, deletedAt: null } })
  if (!project) throw createError('Project not found', 404)

  const user = await prisma.user.findUnique({ where: { id: userId, deletedAt: null, isActive: true } })
  if (!user) throw createError('User not found', 404)

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  })
  if (existing) throw createError('User is already a member', 409)

  await prisma.projectMember.create({ data: { projectId, userId } })

  // Notify lead (skip if lead is adding themselves)
  if (project.leadId !== userId) {
    await createNotification({
      userId: project.leadId,
      type: 'MEMBER_ADDED',
      message: `${user.name || user.email} was added to ${project.name}`,
      link: `/projects/${projectId}`,
    })
  }

  return prisma.project.findUnique({ where: { id: projectId }, select: projectSelect })
}

export async function removeMember(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId, deletedAt: null } })
  if (!project) throw createError('Project not found', 404)

  if (project.leadId === userId) throw createError('Cannot remove the project lead', 400)

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  })
  if (!existing) throw createError('User is not a member', 404)

  await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } })
}
