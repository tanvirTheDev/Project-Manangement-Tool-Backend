import { z } from 'zod'
import { InvoiceStatus } from '@prisma/client'

export const generateInvoiceSchema = z
  .object({
    clientId: z.string().uuid(),
    projectId: z.string().uuid().optional(),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    hourlyRate: z.coerce.number().positive().max(100_000),
    notes: z.string().max(1000).optional(),
  })
  .refine((d) => d.periodEnd >= d.periodStart, {
    message: 'periodEnd must be after periodStart',
    path: ['periodEnd'],
  })

export const updateInvoiceSchema = z.object({
  status: z.nativeEnum(InvoiceStatus).optional(),
  notes: z.string().max(1000).optional(),
})

export const listInvoicesQuerySchema = z.object({
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>
