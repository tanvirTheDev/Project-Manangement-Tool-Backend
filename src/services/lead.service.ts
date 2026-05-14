import { prisma } from '../lib/db'
import { createError } from '../lib/api-response'
import { LeadStatus, LeadActivityType, UserRole, type Prisma } from '@prisma/client'
import { Resend } from 'resend'
import { env } from '../lib/env'
import { LEAD_EMAIL_TEMPLATES, renderLeadEmailHtml } from '../emails/leads'
import type { CreateLeadInput, UpdateLeadInput, MoveLeadInput, LogActivityInput, SendLeadEmailInput, ListLeadsQueryInput } from '../validations/lead'

const resend = new Resend(env.RESEND_API_KEY)

const leadSelect = {
  id: true, companyName: true, industry: true, contactPerson: true, designation: true,
  email: true, phone: true, whatsapp: true, source: true, status: true, position: true,
  interestedIn: true, estimatedValue: true, notes: true, assignedToId: true, createdById: true,
  lastContactedAt: true, expectedCloseAt: true, wonAt: true, lostAt: true, lostReason: true,
  createdAt: true, updatedAt: true, deletedAt: true,
  assignedTo: { select: { id: true, name: true, avatar: true } },
  createdBy: { select: { id: true, name: true, avatar: true } },
} as const

function requireAdminOrManager(role: UserRole) {
  if (role !== UserRole.ADMIN && role !== UserRole.MANAGER) {
    throw createError('Access denied', 403)
  }
}

async function autoLogActivity(leadId: string, userId: string, type: LeadActivityType, title: string, description?: string) {
  await prisma.leadActivity.create({ data: { leadId, userId, type, title, description } })
}

export async function getLeads(query: ListLeadsQueryInput, requesterId: string, requesterRole: UserRole) {
  requireAdminOrManager(requesterRole)

  const where: Prisma.LeadWhereInput = {
    deletedAt: null,
    ...(query.status && { status: query.status }),
    ...(query.industry && { industry: query.industry }),
    ...(query.source && { source: query.source }),
    ...(query.assignedToId && { assignedToId: query.assignedToId }),
    ...(query.search && {
      OR: [
        { companyName: { contains: query.search, mode: 'insensitive' } },
        { contactPerson: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
    ...(query.cursor && { id: { lt: query.cursor } }),
  }

  const leads = await prisma.lead.findMany({
    where,
    select: leadSelect,
    orderBy: [{ status: 'asc' }, { position: 'asc' }, { createdAt: 'desc' }],
    take: query.limit + 1,
  })

  const hasMore = leads.length > query.limit
  const page = hasMore ? leads.slice(0, query.limit) : leads
  const nextCursor = hasMore ? page[page.length - 1].id : undefined
  const total = await prisma.lead.count({ where })

  return { leads: page, nextCursor, total }
}

export async function getLeadById(id: string, requesterRole: UserRole) {
  requireAdminOrManager(requesterRole)
  const lead = await prisma.lead.findUnique({
    where: { id, deletedAt: null },
    select: {
      ...leadSelect,
      activities: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, type: true, title: true, description: true, createdAt: true,
          user: { select: { id: true, name: true, avatar: true } },
        },
      },
      emailLogs: {
        orderBy: { sentAt: 'desc' },
        select: {
          id: true, subject: true, templateKey: true, status: true, sentAt: true,
          sentBy: { select: { id: true, name: true, avatar: true } },
        },
      },
    },
  })
  if (!lead) throw createError('Lead not found', 404)
  return lead
}

export async function createLead(data: CreateLeadInput, creatorId: string, requesterRole: UserRole) {
  requireAdminOrManager(requesterRole)
  const lead = await prisma.lead.create({
    data: {
      companyName: data.companyName,
      industry: data.industry,
      contactPerson: data.contactPerson,
      designation: data.designation,
      email: data.email,
      phone: data.phone,
      whatsapp: data.whatsapp,
      source: data.source,
      status: data.status,
      interestedIn: data.interestedIn,
      estimatedValue: data.estimatedValue,
      notes: data.notes,
      assignedToId: data.assignedToId,
      expectedCloseAt: data.expectedCloseAt,
      createdById: creatorId,
    },
    select: leadSelect,
  })
  await autoLogActivity(lead.id, creatorId, LeadActivityType.NOTE, 'Lead created')
  return lead
}

export async function updateLead(id: string, data: UpdateLeadInput, userId: string, requesterRole: UserRole) {
  requireAdminOrManager(requesterRole)
  const existing = await prisma.lead.findUnique({ where: { id, deletedAt: null }, select: { status: true } })
  if (!existing) throw createError('Lead not found', 404)

  if (data.status === LeadStatus.LOST && !data.lostReason) {
    throw createError('lostReason is required when marking a lead as LOST', 400)
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      ...data,
      estimatedValue: data.estimatedValue,
      ...(data.status === LeadStatus.WON && { wonAt: new Date() }),
      ...(data.status === LeadStatus.LOST && { lostAt: new Date() }),
    },
    select: leadSelect,
  })

  if (data.status && data.status !== existing.status) {
    await autoLogActivity(id, userId, LeadActivityType.STATUS_CHANGED, `Moved to ${data.status.replace('_', ' ')}`)
  }

  return updated
}

export async function moveLead(id: string, data: MoveLeadInput, userId: string, requesterRole: UserRole) {
  requireAdminOrManager(requesterRole)
  const existing = await prisma.lead.findUnique({ where: { id, deletedAt: null }, select: { status: true } })
  if (!existing) throw createError('Lead not found', 404)

  const updated = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.update({
      where: { id },
      data: {
        status: data.status,
        position: data.position,
        ...(data.status === LeadStatus.WON && { wonAt: new Date() }),
        ...(data.status === LeadStatus.LOST && { lostAt: new Date() }),
      },
      select: leadSelect,
    })
    if (data.status !== existing.status) {
      await tx.leadActivity.create({
        data: { leadId: id, userId, type: LeadActivityType.STATUS_CHANGED, title: `Moved to ${data.status.replace('_', ' ')}` },
      })
    }
    return lead
  })

  return updated
}

export async function logActivity(leadId: string, data: LogActivityInput, userId: string, requesterRole: UserRole) {
  requireAdminOrManager(requesterRole)
  const lead = await prisma.lead.findUnique({ where: { id: leadId, deletedAt: null }, select: { id: true } })
  if (!lead) throw createError('Lead not found', 404)

  const [activity] = await Promise.all([
    prisma.leadActivity.create({
      data: { leadId, userId, type: data.type, title: data.title, description: data.description },
      select: {
        id: true, type: true, title: true, description: true, createdAt: true,
        user: { select: { id: true, name: true, avatar: true } },
      },
    }),
    prisma.lead.update({ where: { id: leadId }, data: { lastContactedAt: new Date() } }),
  ])

  return activity
}

export async function sendLeadEmail(leadId: string, data: SendLeadEmailInput, userId: string, requesterRole: UserRole) {
  requireAdminOrManager(requesterRole)

  const lead = await prisma.lead.findUnique({
    where: { id: leadId, deletedAt: null },
    select: { id: true, companyName: true, contactPerson: true, email: true, lastContactedAt: true },
  })
  if (!lead) throw createError('Lead not found', 404)
  if (!lead.email) throw createError('Lead has no email address', 400)

  const template = LEAD_EMAIL_TEMPLATES[data.templateKey]
  if (!template) throw createError('Invalid template key', 400)

  const sender = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
  const html = renderLeadEmailHtml(data.templateKey, lead, { name: sender?.name ?? 'DataFever Team' })
  if (!html) throw createError('Could not render email template', 500)

  const subject = data.subject ?? template.defaultSubject

  const { error } = await resend.emails.send({ from: env.FROM_EMAIL, to: lead.email, subject, html })
  if (error) throw createError(`Email send failed: ${error.message}`, 500)

  await Promise.all([
    prisma.leadEmailLog.create({ data: { leadId, sentById: userId, subject, templateKey: data.templateKey } }),
    autoLogActivity(leadId, userId, LeadActivityType.EMAIL_SENT, `Email sent: ${subject}`),
    prisma.lead.update({ where: { id: leadId }, data: { lastContactedAt: new Date() } }),
  ])

  return { sent: true }
}

export async function softDeleteLead(id: string, requesterRole: UserRole) {
  if (requesterRole !== UserRole.ADMIN) throw createError('Only admins can archive leads', 403)
  const lead = await prisma.lead.findUnique({ where: { id, deletedAt: null }, select: { id: true } })
  if (!lead) throw createError('Lead not found', 404)
  await prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } })
}

export async function getLeadStats(requesterRole: UserRole) {
  requireAdminOrManager(requesterRole)

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
  weekStart.setHours(0, 0, 0, 0)

  const [pipeline, wonCount, lostCount] = await Promise.all([
    prisma.lead.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { id: true },
      _sum: { estimatedValue: true },
    }),
    prisma.lead.count({ where: { deletedAt: null, status: LeadStatus.WON } }),
    prisma.lead.count({ where: { deletedAt: null, status: LeadStatus.LOST } }),
  ])

  const totalClosed = wonCount + lostCount
  const conversionRate = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : 0

  const wonValueRow = pipeline.find((p) => p.status === LeadStatus.WON)
  const totalWonValue = wonValueRow?._sum?.estimatedValue ? Number(wonValueRow._sum.estimatedValue) : 0

  const activeStatuses: LeadStatus[] = [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.INTERESTED, LeadStatus.PROPOSAL_SENT]
  const totalActiveLeads = pipeline
    .filter((p) => activeStatuses.includes(p.status as LeadStatus))
    .reduce((sum, p) => sum + p._count.id, 0)

  return {
    pipeline: pipeline.map((p) => ({
      status: p.status,
      count: p._count.id,
      totalEstimatedValue: p._sum?.estimatedValue ? Number(p._sum.estimatedValue) : 0,
    })),
    conversionRate,
    totalActiveLeads,
    totalWonValue,
  }
}
