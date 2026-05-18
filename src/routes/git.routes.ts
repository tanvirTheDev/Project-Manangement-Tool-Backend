import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { successRes, errorRes, handleRouteError } from '../lib/api-response'
import { createGitLinkSchema } from '../validations/git'
import { getGitLinksForTask, createManualGitLink, deleteGitLink } from '../services/git.service'

const router = Router({ mergeParams: true })

// GET /api/tasks/:id/git
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await getGitLinksForTask(req.params.id)
    successRes(res, data)
  } catch (e) { handleRouteError(res, e) }
})

// POST /api/tasks/:id/git
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createGitLinkSchema.safeParse(req.body)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const data = await createManualGitLink(req.params.id, parsed.data, req.auth!.userId, req.auth!.role)
    successRes(res, data, 201)
  } catch (e) { handleRouteError(res, e) }
})

// DELETE /api/tasks/:id/git/:linkId
router.delete('/:linkId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await deleteGitLink(req.params.id, req.params.linkId, req.auth!.role)
    successRes(res, { deleted: true })
  } catch (e) { handleRouteError(res, e) }
})

export { router as gitRouter }
