import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { createTimeEntrySchema, timesheetQuerySchema } from '../validations/timesheet'
import { getTimeEntries, logTime, deleteTimeEntry } from '../services/timesheet.service'
import { successRes, errorRes, handleRouteError } from '../lib/api-response'

const router = Router()

// GET /api/timesheets
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = timesheetQuerySchema.safeParse(req.query)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const entries = await getTimeEntries(req.auth!.userId, req.auth!.role, parsed.data)
    successRes(res, entries)
  } catch (error) { handleRouteError(res, error) }
})

// POST /api/timesheets
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createTimeEntrySchema.safeParse(req.body)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const entry = await logTime(parsed.data, req.auth!.userId)
    successRes(res, entry, 201)
  } catch (error) { handleRouteError(res, error) }
})

// DELETE /api/timesheets/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await deleteTimeEntry(req.params.id, req.auth!.userId, req.auth!.role)
    successRes(res, { message: 'Time entry deleted' })
  } catch (error) { handleRouteError(res, error) }
})

export { router as timesheetsRouter }
