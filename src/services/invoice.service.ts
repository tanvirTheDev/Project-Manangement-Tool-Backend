import { prisma } from '../lib/db'
import { createError } from '../lib/api-response'
import { InvoiceStatus, UserRole } from '@prisma/client'
import { generateInvoicePdf } from '../lib/pdf.service'
import { uploadPdf } from '../lib/cloudinary'
import type { GenerateInvoiceInput, UpdateInvoiceInput, ListInvoicesQuery } from '../validations/invoice'

const invoiceSelect = {
  id: true, invoiceNumber: true, status: true,
  periodStart: true, periodEnd: true,
  hourlyRate: true, totalHours: true, totalAmount: true,
  notes: true, pdfUrl: true, generatedAt: true, createdAt: true,
  client: { select: { id: true, name: true, contactPerson: true } },
  project: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} as const

function assertManagerRole(role: UserRole) {
  if (role !== UserRole.ADMIN && role !== UserRole.MANAGER) {
    throw createError('Only ADMIN or MANAGER can manage invoices', 403)
  }
}

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`
  const last = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  })
  const nextNum = last ? parseInt(last.invoiceNumber.split('-')[2]) + 1 : 1
  return `${prefix}${String(nextNum).padStart(3, '0')}`
}

export async function generateInvoice(data: GenerateInvoiceInput, creatorId: string, creatorRole: UserRole) {
  assertManagerRole(creatorRole)

  const client = await prisma.client.findFirst({ where: { id: data.clientId, deletedAt: null } })
  if (!client) throw createError('Client not found', 404)

  // Gather project IDs to scope time entries
  let projectIds: string[]
  if (data.projectId) {
    projectIds = [data.projectId]
  } else {
    const projects = await prisma.project.findMany({
      where: { clientId: data.clientId, deletedAt: null },
      select: { id: true },
    })
    projectIds = projects.map((p) => p.id)
  }

  if (projectIds.length === 0) throw createError('No projects found for this client', 400)

  // Fetch time entries for the period via task → project
  const entries = await prisma.timeEntry.findMany({
    where: {
      task: { projectId: { in: projectIds }, deletedAt: null },
      date: { gte: data.periodStart, lte: data.periodEnd },
      deletedAt: null,
    },
    include: {
      user: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
    orderBy: [{ date: 'asc' }, { userId: 'asc' }],
  })

  if (entries.length === 0) throw createError('No time entries found for this period', 400)

  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0)
  const totalAmount = totalHours * data.hourlyRate
  const invoiceNumber = await generateInvoiceNumber()

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        invoiceNumber,
        clientId: data.clientId,
        projectId: data.projectId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        hourlyRate: data.hourlyRate,
        totalHours,
        totalAmount,
        notes: data.notes,
        createdById: creatorId,
      },
    })

    await tx.invoiceLineItem.createMany({
      data: entries.map((e) => ({
        invoiceId: inv.id,
        userId: e.userId,
        taskId: e.taskId,
        taskTitle: e.task.title,
        hours: e.hours,
        date: e.date,
        description: e.description ?? undefined,
      })),
    })

    return inv
  })

  return prisma.invoice.findUnique({ where: { id: invoice.id }, select: invoiceSelect })
}

export async function getInvoices(query: ListInvoicesQuery, requesterRole: UserRole) {
  assertManagerRole(requesterRole)

  const where = {
    deletedAt: null,
    ...(query.clientId ? { clientId: query.clientId } : {}),
    ...(query.projectId ? { projectId: query.projectId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.cursor ? { id: { gt: query.cursor } } : {}),
  }

  const invoices = await prisma.invoice.findMany({
    where,
    select: invoiceSelect,
    orderBy: { createdAt: 'desc' },
    take: query.limit + 1,
  })

  const hasMore = invoices.length > query.limit
  const items = hasMore ? invoices.slice(0, query.limit) : invoices
  return { invoices: items, nextCursor: hasMore ? items[items.length - 1].id : undefined, total: items.length }
}

export async function getInvoiceById(id: string, requesterRole: UserRole) {
  assertManagerRole(requesterRole)
  const invoice = await prisma.invoice.findFirst({
    where: { id, deletedAt: null },
    include: {
      client: { select: { id: true, name: true, contactPerson: true } },
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      lineItems: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: [{ date: 'asc' }, { userId: 'asc' }],
      },
    },
  })
  if (!invoice) throw createError('Invoice not found', 404)
  return invoice
}

export async function updateInvoice(id: string, data: UpdateInvoiceInput, requesterRole: UserRole) {
  assertManagerRole(requesterRole)
  const invoice = await prisma.invoice.findFirst({ where: { id, deletedAt: null } })
  if (!invoice) throw createError('Invoice not found', 404)
  if (invoice.status === InvoiceStatus.PAID) throw createError('PAID invoices cannot be modified', 400)

  if (data.status) {
    const allowed: Partial<Record<InvoiceStatus, InvoiceStatus[]>> = {
      DRAFT: [InvoiceStatus.SENT, InvoiceStatus.CANCELLED],
      SENT: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
    }
    if (!allowed[invoice.status]?.includes(data.status)) {
      throw createError(`Cannot transition from ${invoice.status} to ${data.status}`, 400)
    }
  }

  return prisma.invoice.update({ where: { id }, data, select: invoiceSelect })
}

export async function generateAndUploadPdf(id: string, requesterRole: UserRole) {
  assertManagerRole(requesterRole)
  const invoice = await getInvoiceById(id, requesterRole)

  const pdfBytes = await generateInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.client.name,
    clientContactPerson: invoice.client.contactPerson,
    projectName: invoice.project?.name,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    hourlyRate: invoice.hourlyRate,
    totalHours: invoice.totalHours,
    totalAmount: invoice.totalAmount,
    notes: invoice.notes,
    lineItems: invoice.lineItems.map((li) => ({
      date: li.date,
      userName: li.user.name,
      taskTitle: li.taskTitle,
      hours: li.hours,
      hourlyRate: invoice.hourlyRate,
      description: li.description,
    })),
  })

  const { url } = await uploadPdf(Buffer.from(pdfBytes), 'invoices')
  await prisma.invoice.update({
    where: { id },
    data: { pdfUrl: url, generatedAt: new Date() },
  })
  return { pdfUrl: url }
}

export async function deleteInvoice(id: string, requesterRole: UserRole) {
  if (requesterRole !== UserRole.ADMIN) throw createError('Only ADMIN can delete invoices', 403)
  const invoice = await prisma.invoice.findFirst({ where: { id, deletedAt: null } })
  if (!invoice) throw createError('Invoice not found', 404)
  if (invoice.status !== InvoiceStatus.DRAFT) throw createError('Only DRAFT invoices can be deleted', 400)
  await prisma.invoice.update({ where: { id }, data: { deletedAt: new Date() } })
}
