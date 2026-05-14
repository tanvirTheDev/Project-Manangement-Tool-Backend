import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { searchQuerySchema } from '../validations/search'
import { search } from '../services/search.service'
import { successRes, errorRes, handleRouteError } from '../lib/api-response'

const router = Router()

// GET /api/search
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = searchQuerySchema.safeParse(req.query)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const result = await search({
      q: parsed.data.q,
      requesterId: req.auth!.userId,
      requesterRole: req.auth!.role,
      types: parsed.data.types,
      limit: parsed.data.limit,
    })
    successRes(res, result, 200, result.meta)
  } catch (error) { handleRouteError(res, error) }
})

export default router
