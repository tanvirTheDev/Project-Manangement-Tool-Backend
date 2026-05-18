import { z } from 'zod'

export const createGitLinkSchema = z.object({
  provider: z.enum(['github', 'gitlab']),
  repoUrl: z.string().url(),
  branchName: z.string().min(1).optional(),
})

export type CreateGitLinkInput = z.infer<typeof createGitLinkSchema>
