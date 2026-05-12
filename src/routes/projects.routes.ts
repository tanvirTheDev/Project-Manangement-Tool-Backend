import { Router, Request, Response } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  listProjectsQuerySchema, createProjectSchema, updateProjectSchema, addMemberSchema,
} from '../validations/project'
import {
  getProjects, getProjectById, createProject, updateProject, addMember, removeMember,
} from '../services/project.service'
import { taskFiltersSchema, createTaskSchema } from '../validations/task'
import { getTasks, createTask } from '../services/task.service'
import { successRes, errorRes, handleRouteError } from '../lib/api-response'

const router = Router()

// GET /api/projects — role-filtered
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = listProjectsQuerySchema.safeParse(req.query)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const result = await getProjects(parsed.data, req.auth!.userId, req.auth!.role)
    successRes(res, result)
  } catch (error) { handleRouteError(res, error) }
})

// POST /api/projects — ADMIN, MANAGER
router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createProjectSchema.safeParse(req.body)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const project = await createProject(parsed.data)
    successRes(res, project, 201)
  } catch (error) { handleRouteError(res, error) }
})

// GET /api/projects/:id
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await getProjectById(req.params.id, req.auth!.userId, req.auth!.role)
    successRes(res, project)
  } catch (error) { handleRouteError(res, error) }
})

// PATCH /api/projects/:id — ADMIN/MANAGER/Lead
router.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = updateProjectSchema.safeParse(req.body)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const project = await updateProject(req.params.id, parsed.data, req.auth!.userId, req.auth!.role)
    successRes(res, project)
  } catch (error) { handleRouteError(res, error) }
})

// POST /api/projects/:id/members — ADMIN, MANAGER
router.post('/:id/members', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = addMemberSchema.safeParse(req.body)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const project = await addMember(req.params.id, parsed.data.userId, req.auth!.userId)
    successRes(res, project)
  } catch (error) { handleRouteError(res, error) }
})

// DELETE /api/projects/:id/members/:uid — ADMIN, MANAGER
router.delete('/:id/members/:uid', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response): Promise<void> => {
  try {
    await removeMember(req.params.id, req.params.uid)
    successRes(res, { message: 'Member removed' })
  } catch (error) { handleRouteError(res, error) }
})

// GET /api/projects/:id/tasks
router.get('/:id/tasks', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = taskFiltersSchema.safeParse(req.query)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const result = await getTasks(req.params.id, parsed.data, req.auth!.userId, req.auth!.role)
    successRes(res, result)
  } catch (error) { handleRouteError(res, error) }
})

// POST /api/projects/:id/tasks
router.post('/:id/tasks', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createTaskSchema.safeParse(req.body)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const task = await createTask(req.params.id, parsed.data, req.auth!.userId, req.auth!.role)
    successRes(res, task, 201)
  } catch (error) { handleRouteError(res, error) }
})

export { router as projectsRouter }
