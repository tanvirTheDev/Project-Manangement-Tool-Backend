import { prisma } from '../lib/db'
import { createError } from '../lib/api-response'
import { ClientStatus, UserRole, type Prisma } from '@prisma/client'
import type { CreateClientInput, UpdateClientInput, ListClientsQuery } from '../validations/client'

const clientWithManager = {
  id: true, name: true, contactPerson: true, email: true, phone: true,
  status: true, notes: true, accountManagerId: true, createdAt: true,
  updatedAt: true, deletedAt: true,
  accountManager: {
    select: { id: true, name: true, avatar: true, email: true },
  },
} as const

export async function getClients(query: ListClientsQuery) {
  const { search, status, accountManagerId, includeArchived, cursor, limit } = query

  const where: Prisma.ClientWhereInput = {
    ...(includeArchived ? {} : { deletedAt: null }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
    ...(status && { status }),
    ...(accountManagerId && { accountManagerId }),
    ...(cursor && { id: { gt: cursor } }),
  }

  const clients = await prisma.client.findMany({
    where,
    select: clientWithManager,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  })

  const hasMore = clients.length > limit
  const data = hasMore ? clients.slice(0, limit) : clients
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined
  const total = await prisma.client.count({ where: { deletedAt: null } })

  return { clients: data, nextCursor, total }
}

export async function getClientById(id: string, requesterId: string, requesterRole: UserRole) {
  const client = await prisma.client.findUnique({
    where: { id, deletedAt: null },
    select: { ...clientWithManager },
  })
  if (!client) throw createError('Client not found', 404)

  if (requesterRole === UserRole.MEMBER) {
    const membership = await prisma.projectMember.findFirst({
      where: { userId: requesterId, project: { clientId: id, deletedAt: null } },
    })
    if (!membership) throw createError('Access denied', 403)
  }

  return client
}

export async function createClient(data: CreateClientInput) {
  if (data.accountManagerId) {
    const manager = await prisma.user.findUnique({
      where: { id: data.accountManagerId, deletedAt: null, isActive: true },
    })
    if (!manager) throw createError('Account manager not found', 404)
  }

  return prisma.client.create({
    data: {
      name: data.name,
      contactPerson: data.contactPerson,
      email: data.email,
      phone: data.phone,
      status: data.status ?? ClientStatus.ACTIVE,
      notes: data.notes,
      accountManagerId: data.accountManagerId,
    },
    select: clientWithManager,
  })
}

export async function updateClient(id: string, data: UpdateClientInput) {
  const client = await prisma.client.findUnique({ where: { id, deletedAt: null } })
  if (!client) throw createError('Client not found', 404)

  if (data.accountManagerId) {
    const manager = await prisma.user.findUnique({
      where: { id: data.accountManagerId, deletedAt: null, isActive: true },
    })
    if (!manager) throw createError('Account manager not found', 404)
  }

  return prisma.client.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.contactPerson !== undefined && { contactPerson: data.contactPerson }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.accountManagerId !== undefined && { accountManagerId: data.accountManagerId }),
    },
    select: clientWithManager,
  })
}

export async function archiveClient(id: string, requesterId: string) {
  const client = await prisma.client.findUnique({ where: { id, deletedAt: null } })
  if (!client) throw createError('Client not found', 404)

  return prisma.client.update({
    where: { id },
    data: { deletedAt: new Date() },
    select: clientWithManager,
  })
}
