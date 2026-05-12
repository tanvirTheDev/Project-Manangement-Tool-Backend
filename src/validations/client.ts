import { z } from 'zod'
import { ClientStatus } from '@prisma/client'

export const createClientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  contactPerson: z.string().min(1, 'Contact person is required').max(200),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  status: z.nativeEnum(ClientStatus).default('ACTIVE'),
  notes: z.string().optional(),
  accountManagerId: z.string().uuid('Invalid account manager ID').optional(),
})

export const updateClientSchema = createClientSchema.partial()

export const listClientsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(ClientStatus).optional(),
  accountManagerId: z.string().uuid().optional(),
  includeArchived: z.coerce.boolean().default(false),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>
