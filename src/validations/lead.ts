import { z } from 'zod'
import { LeadIndustry, LeadStatus, LeadSource, LeadActivityType } from '@prisma/client'

export const createLeadSchema = z.object({
  companyName: z.string().min(1).max(200),
  industry: z.nativeEnum(LeadIndustry),
  contactPerson: z.string().min(1).max(200),
  designation: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  phone: z.string().min(7).max(20),
  whatsapp: z.string().optional(),
  source: z.nativeEnum(LeadSource).default('COLD_OUTREACH'),
  status: z.nativeEnum(LeadStatus).default('NEW'),
  interestedIn: z.string().max(300).optional(),
  estimatedValue: z.coerce.number().positive().optional(),
  notes: z.string().optional(),
  assignedToId: z.string().uuid().optional(),
  expectedCloseAt: z.coerce.date().optional(),
})

export const updateLeadSchema = createLeadSchema.partial().extend({
  lostReason: z.string().max(500).optional(),
})

export const moveLeadSchema = z.object({
  status: z.nativeEnum(LeadStatus),
  position: z.number().int().min(0),
})

export const logActivitySchema = z.object({
  type: z.nativeEnum(LeadActivityType),
  title: z.string().min(1).max(300),
  description: z.string().optional(),
})

export const sendLeadEmailSchema = z.object({
  templateKey: z.string().min(1),
  subject: z.string().min(1).max(200).optional(),
})

export const listLeadsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  industry: z.nativeEnum(LeadIndustry).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  assignedToId: z.string().uuid().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export type CreateLeadInput = z.infer<typeof createLeadSchema>
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>
export type MoveLeadInput = z.infer<typeof moveLeadSchema>
export type LogActivityInput = z.infer<typeof logActivitySchema>
export type SendLeadEmailInput = z.infer<typeof sendLeadEmailSchema>
export type ListLeadsQueryInput = z.infer<typeof listLeadsQuerySchema>
