import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import {
  listLeadsQuerySchema, createLeadSchema, updateLeadSchema,
  moveLeadSchema, logActivitySchema, sendLeadEmailSchema,
} from '../validations/lead'
import {
  getLeads, getLeadById, createLead, updateLead, moveLead,
  logActivity, sendLeadEmail, softDeleteLead, getLeadStats,
} from '../services/lead.service'
import { successRes, errorRes, handleRouteError } from '../lib/api-response'

const router = Router()

// GET /api/leads/stats
router.get('/stats', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await getLeadStats(req.auth!.role)
    successRes(res, result)
  } catch (error) { handleRouteError(res, error) }
})

// GET /api/leads
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = listLeadsQuerySchema.safeParse(req.query)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const result = await getLeads(parsed.data, req.auth!.userId, req.auth!.role)
    successRes(res, result, 200, { nextCursor: result.nextCursor, total: result.total })
  } catch (error) { handleRouteError(res, error) }
})

// POST /api/leads
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createLeadSchema.safeParse(req.body)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const lead = await createLead(parsed.data, req.auth!.userId, req.auth!.role)
    successRes(res, lead, 201)
  } catch (error) { handleRouteError(res, error) }
})

// GET /api/leads/:id
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const lead = await getLeadById(req.params.id, req.auth!.role)
    successRes(res, lead)
  } catch (error) { handleRouteError(res, error) }
})

// PATCH /api/leads/:id
router.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = updateLeadSchema.safeParse(req.body)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const lead = await updateLead(req.params.id, parsed.data, req.auth!.userId, req.auth!.role)
    successRes(res, lead)
  } catch (error) { handleRouteError(res, error) }
})

// DELETE /api/leads/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await softDeleteLead(req.params.id, req.auth!.role)
    successRes(res, null)
  } catch (error) { handleRouteError(res, error) }
})

// PATCH /api/leads/:id/move
router.patch('/:id/move', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = moveLeadSchema.safeParse(req.body)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const lead = await moveLead(req.params.id, parsed.data, req.auth!.userId, req.auth!.role)
    successRes(res, lead)
  } catch (error) { handleRouteError(res, error) }
})

// POST /api/leads/:id/activities
router.post('/:id/activities', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = logActivitySchema.safeParse(req.body)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const activity = await logActivity(req.params.id, parsed.data, req.auth!.userId, req.auth!.role)
    successRes(res, activity, 201)
  } catch (error) { handleRouteError(res, error) }
})

// POST /api/leads/:id/email
router.post('/:id/email', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = sendLeadEmailSchema.safeParse(req.body)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const result = await sendLeadEmail(req.params.id, parsed.data, req.auth!.userId, req.auth!.role)
    successRes(res, result)
  } catch (error) { handleRouteError(res, error) }
})

export default router
