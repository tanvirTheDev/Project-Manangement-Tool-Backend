import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { notificationQuerySchema } from '../validations/notification'
import { getUserNotifications, markRead, markAllRead } from '../services/notification.service'
import { successRes, errorRes, handleRouteError } from '../lib/api-response'

const router = Router()

// GET /api/notifications
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = notificationQuerySchema.safeParse(req.query)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const result = await getUserNotifications(req.auth!.userId, parsed.data.unreadOnly)
    res.json({ success: true, data: result.notifications, meta: result.meta })
  } catch (error) { handleRouteError(res, error) }
})

// PATCH /api/notifications/read-all
router.patch('/read-all', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await markAllRead(req.auth!.userId)
    successRes(res, result)
  } catch (error) { handleRouteError(res, error) }
})

// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const notif = await markRead(req.params.id, req.auth!.userId)
    successRes(res, notif)
  } catch (error) { handleRouteError(res, error) }
})

export { router as notificationsRouter }
