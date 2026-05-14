import { z } from 'zod'

export const searchQuerySchema = z.object({
  q: z.string().min(2).max(100),
  types: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',') : ['tasks', 'projects', 'clients', 'users'])),
  limit: z.coerce.number().min(1).max(10).default(5),
})

export type SearchQueryInput = z.infer<typeof searchQuerySchema>
