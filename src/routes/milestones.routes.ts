import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { successRes, errorRes, handleRouteError } from '../lib/api-response'
import {
  createMilestoneSchema, updateMilestoneSchema, addTasksToMilestoneSchema, listMilestonesQuerySchema,
} from '../validations/milestone'
import {
  getMilestones, getMilestoneById, createMilestone, updateMilestone,
  archiveMilestone, addTasksToMilestone, removeTaskFromMilestone, getBurndownData,
} from '../services/milestone.service'

const router = Router({ mergeParams: true })

// GET /api/projects/:id/milestones
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = listMilestonesQuerySchema.safeParse(req.query)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const data = await getMilestones(req.params.id, parsed.data, req.auth!.userId, req.auth!.role)
    successRes(res, data)
  } catch (e) { handleRouteError(res, e) }
})

// POST /api/projects/:id/milestones
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createMilestoneSchema.safeParse(req.body)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const data = await createMilestone(req.params.id, parsed.data, req.auth!.userId, req.auth!.role)
    successRes(res, data, 201)
  } catch (e) { handleRouteError(res, e) }
})

// GET /api/projects/:id/milestones/:mid
router.get('/:mid', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await getMilestoneById(req.params.mid, req.auth!.userId, req.auth!.role)
    successRes(res, data)
  } catch (e) { handleRouteError(res, e) }
})

// PATCH /api/projects/:id/milestones/:mid
router.patch('/:mid', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = updateMilestoneSchema.safeParse(req.body)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const data = await updateMilestone(req.params.mid, parsed.data, req.auth!.role)
    successRes(res, data)
  } catch (e) { handleRouteError(res, e) }
})

// DELETE /api/projects/:id/milestones/:mid
router.delete('/:mid', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await archiveMilestone(req.params.mid, req.auth!.role)
    successRes(res, { archived: true })
  } catch (e) { handleRouteError(res, e) }
})

// POST /api/projects/:id/milestones/:mid/tasks
router.post('/:mid/tasks', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = addTasksToMilestoneSchema.safeParse(req.body)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const data = await addTasksToMilestone(req.params.mid, parsed.data.taskIds, req.auth!.role)
    successRes(res, data)
  } catch (e) { handleRouteError(res, e) }
})

// DELETE /api/projects/:id/milestones/:mid/tasks/:tid
router.delete('/:mid/tasks/:tid', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await removeTaskFromMilestone(req.params.mid, req.params.tid, req.auth!.role)
    successRes(res, { removed: true })
  } catch (e) { handleRouteError(res, e) }
})

// GET /api/projects/:id/milestones/:mid/burndown
router.get('/:mid/burndown', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await getBurndownData(req.params.mid, req.auth!.userId, req.auth!.role)
    successRes(res, data)
  } catch (e) { handleRouteError(res, e) }
})

export { router as milestonesRouter }
