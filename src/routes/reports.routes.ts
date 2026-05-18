import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { successRes, errorRes, handleRouteError } from '../lib/api-response'
import { utilizationQuerySchema, velocityQuerySchema, projectSummaryQuerySchema } from '../validations/reports'
import { getTeamUtilization, getTaskVelocity, getProjectSummary } from '../services/report.service'

const router = Router()

router.get('/team-utilization', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = utilizationQuerySchema.safeParse(req.query)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const result = await getTeamUtilization(parsed.data, req.auth!.role)
    successRes(res, { users: result.data, ...result.meta })
  } catch (e) { handleRouteError(res, e) }
})

router.get('/task-velocity', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = velocityQuerySchema.safeParse(req.query)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const result = await getTaskVelocity(parsed.data, req.auth!.userId, req.auth!.role)
    successRes(res, { weeks: result.data, ...result.meta })
  } catch (e) { handleRouteError(res, e) }
})

router.get('/project-summary', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = projectSummaryQuerySchema.safeParse(req.query)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const result = await getProjectSummary(parsed.data, req.auth!.role)
    successRes(res, { clients: result.data })
  } catch (e) { handleRouteError(res, e) }
})

export { router as reportsRouter }
