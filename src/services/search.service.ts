import { prisma } from '../lib/db'
import { UserRole } from '@prisma/client'

interface SearchParams {
  q: string
  requesterId: string
  requesterRole: UserRole
  types: string[]
  limit: number
}

export async function search({ q, requesterId, requesterRole, types, limit }: SearchParams) {
  const mode = 'insensitive' as const
  const isMember = requesterRole === UserRole.MEMBER

  // For MEMBER: get their project IDs first
  let memberProjectIds: string[] = []
  if (isMember) {
    const memberships = await prisma.projectMember.findMany({
      where: { userId: requesterId },
      select: { projectId: true },
    })
    memberProjectIds = memberships.map((m) => m.projectId)
  }

  const [tasks, projects, clients, users] = await Promise.all([
    types.includes('tasks')
      ? prisma.task.findMany({
          where: {
            deletedAt: null,
            ...(isMember && { projectId: { in: memberProjectIds } }),
            OR: [
              { title: { contains: q, mode } },
              { description: { contains: q, mode } },
            ],
          },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            projectId: true,
            project: { select: { name: true } },
            assignee: { select: { avatar: true } },
          },
          take: limit,
        })
      : Promise.resolve([]),

    types.includes('projects')
      ? prisma.project.findMany({
          where: {
            deletedAt: null,
            ...(isMember && { id: { in: memberProjectIds } }),
            OR: [
              { name: { contains: q, mode } },
              { description: { contains: q, mode } },
            ],
          },
          select: {
            id: true,
            name: true,
            status: true,
            client: { select: { name: true } },
            tasks: { where: { deletedAt: null }, select: { status: true } },
          },
          take: limit,
        })
      : Promise.resolve([]),

    types.includes('clients')
      ? prisma.client.findMany({
          where: {
            deletedAt: null,
            ...(isMember && {
              projects: { some: { id: { in: memberProjectIds } } },
            }),
            OR: [
              { name: { contains: q, mode } },
              { contactPerson: { contains: q, mode } },
            ],
          },
          select: {
            id: true,
            name: true,
            contactPerson: true,
            status: true,
          },
          take: limit,
        })
      : Promise.resolve([]),

    types.includes('users')
      ? prisma.user.findMany({
          where: {
            deletedAt: null,
            isActive: true,
            OR: [
              { name: { contains: q, mode } },
              { email: { contains: q, mode } },
              { designation: { contains: q, mode } },
              { department: { contains: q, mode } },
            ],
          },
          select: {
            id: true,
            name: true,
            designation: true,
            department: true,
            avatar: true,
            role: true,
          },
          take: limit,
        })
      : Promise.resolve([]),
  ])

  const taskResults = (tasks as typeof tasks).map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    projectId: t.projectId,
    projectName: t.project.name,
    assigneeAvatar: t.assignee?.avatar ?? null,
  }))

  const projectResults = (projects as typeof projects).map((p) => {
    const done = p.tasks.filter((t) => t.status === 'DONE').length
    const total = p.tasks.length
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      clientName: p.client?.name ?? null,
      progressPercentage: total > 0 ? Math.round((done / total) * 100) : 0,
    }
  })

  const totalResults = taskResults.length + projectResults.length + (clients as typeof clients).length + (users as typeof users).length

  return {
    tasks: taskResults,
    projects: projectResults,
    clients: clients as { id: string; name: string; contactPerson: string; status: string }[],
    users: users as { id: string; name: string; designation: string | null; department: string | null; avatar: string | null; role: string }[],
    meta: { query: q, totalResults },
  }
}
