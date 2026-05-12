import { Router, Request, Response } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import { listClientsQuerySchema, createClientSchema, updateClientSchema } from '../validations/client'
import { getClients, getClientById, createClient, updateClient, archiveClient } from '../services/client.service'
import { successRes, errorRes, handleRouteError } from '../lib/api-response'

const router = Router()

// GET /api/clients — ADMIN, MANAGER
router.get('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = listClientsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      errorRes(res, parsed.error.issues[0].message, 400)
      return
    }
    const result = await getClients(parsed.data)
    successRes(res, result)
  } catch (error) {
    handleRouteError(res, error)
  }
})

// POST /api/clients — ADMIN, MANAGER
router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createClientSchema.safeParse(req.body)
    if (!parsed.success) {
      errorRes(res, parsed.error.issues[0].message, 400)
      return
    }
    const client = await createClient(parsed.data)
    successRes(res, client, 201)
  } catch (error) {
    handleRouteError(res, error)
  }
})

// GET /api/clients/:id — ADMIN, MANAGER, MEMBER (with project membership check)
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const client = await getClientById(req.params.id, req.auth!.userId, req.auth!.role)
    successRes(res, client)
  } catch (error) {
    handleRouteError(res, error)
  }
})

// PATCH /api/clients/:id — ADMIN, MANAGER
router.patch('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = updateClientSchema.safeParse(req.body)
    if (!parsed.success) {
      errorRes(res, parsed.error.issues[0].message, 400)
      return
    }
    const client = await updateClient(req.params.id, parsed.data)
    successRes(res, client)
  } catch (error) {
    handleRouteError(res, error)
  }
})

// DELETE /api/clients/:id — ADMIN, MANAGER (soft delete)
router.delete('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response): Promise<void> => {
  try {
    await archiveClient(req.params.id, req.auth!.userId)
    successRes(res, { message: 'Client archived successfully' })
  } catch (error) {
    handleRouteError(res, error)
  }
})

export { router as clientsRouter }
