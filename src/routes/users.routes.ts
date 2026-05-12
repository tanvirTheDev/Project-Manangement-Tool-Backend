import { Router, Request, Response } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import { listUsersQuerySchema, updateProfileSchema, changeRoleSchema, changeStatusSchema } from '../validations/user'
import { getUsers, getUserById, updateUser, changeRole, changeStatus } from '../services/user.service'
import { successRes, errorRes, handleRouteError } from '../lib/api-response'

const router = Router()

// GET /api/users — Admin only, paginated
router.get('/', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = listUsersQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      errorRes(res, parsed.error.issues[0].message, 400)
      return
    }
    const result = await getUsers(parsed.data)
    successRes(res, result)
  } catch (error) {
    handleRouteError(res, error)
  }
})

// GET /api/users/:id
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getUserById(req.params.id, req.auth!.userId, req.auth!.role)
    successRes(res, user)
  } catch (error) {
    handleRouteError(res, error)
  }
})

// PATCH /api/users/:id — own profile (any) or any user (Admin)
router.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body)
    if (!parsed.success) {
      errorRes(res, parsed.error.issues[0].message, 400)
      return
    }
    const user = await updateUser(req.params.id, parsed.data, req.auth!.userId, req.auth!.role)
    successRes(res, user)
  } catch (error) {
    handleRouteError(res, error)
  }
})

// PATCH /api/users/:id/role — Admin only
router.patch('/:id/role', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = changeRoleSchema.safeParse(req.body)
    if (!parsed.success) {
      errorRes(res, parsed.error.issues[0].message, 400)
      return
    }
    const user = await changeRole(req.params.id, parsed.data, req.auth!.userId)
    successRes(res, user)
  } catch (error) {
    handleRouteError(res, error)
  }
})

// PATCH /api/users/:id/status — Admin only
router.patch('/:id/status', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = changeStatusSchema.safeParse(req.body)
    if (!parsed.success) {
      errorRes(res, parsed.error.issues[0].message, 400)
      return
    }
    const user = await changeStatus(req.params.id, parsed.data, req.auth!.userId)
    successRes(res, user)
  } catch (error) {
    handleRouteError(res, error)
  }
})

export { router as usersRouter }
