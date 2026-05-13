import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { getAdminStats, getManagerStats, getMemberStats, getActivityFeed } from '../services/dashboard.service'
import { successRes, handleRouteError } from '../lib/api-response'
import { UserRole } from '@prisma/client'

const router = Router()

// GET /api/dashboard/stats
router.get('/stats', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role } = req.auth!
    let stats
    if (role === UserRole.ADMIN) stats = await getAdminStats()
    else if (role === UserRole.MANAGER) stats = await getManagerStats(userId)
    else stats = await getMemberStats(userId)
    successRes(res, stats)
  } catch (error) { handleRouteError(res, error) }
})

// GET /api/dashboard/activity
router.get('/activity', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const feed = await getActivityFeed(req.auth!.userId, req.auth!.role)
    successRes(res, feed)
  } catch (error) { handleRouteError(res, error) }
})

export { router as dashboardRouter }
