import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { successRes, errorRes, handleRouteError } from '../lib/api-response'
import { generateInvoiceSchema, updateInvoiceSchema, listInvoicesQuerySchema } from '../validations/invoice'
import {
  generateInvoice, getInvoices, getInvoiceById,
  updateInvoice, generateAndUploadPdf, deleteInvoice,
} from '../services/invoice.service'

const router = Router()

// GET /api/invoices
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = listInvoicesQuerySchema.safeParse(req.query)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const data = await getInvoices(parsed.data, req.auth!.role)
    successRes(res, { invoices: data.invoices, nextCursor: data.nextCursor, total: data.total })
  } catch (e) { handleRouteError(res, e) }
})

// POST /api/invoices/generate
router.post('/generate', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = generateInvoiceSchema.safeParse(req.body)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const data = await generateInvoice(parsed.data, req.auth!.userId, req.auth!.role)
    successRes(res, data, 201)
  } catch (e) { handleRouteError(res, e) }
})

// GET /api/invoices/:id
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await getInvoiceById(req.params.id, req.auth!.role)
    successRes(res, data)
  } catch (e) { handleRouteError(res, e) }
})

// PATCH /api/invoices/:id
router.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = updateInvoiceSchema.safeParse(req.body)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const data = await updateInvoice(req.params.id, parsed.data, req.auth!.role)
    successRes(res, data)
  } catch (e) { handleRouteError(res, e) }
})

// POST /api/invoices/:id/pdf
router.post('/:id/pdf', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await generateAndUploadPdf(req.params.id, req.auth!.role)
    successRes(res, data)
  } catch (e) { handleRouteError(res, e) }
})

// DELETE /api/invoices/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await deleteInvoice(req.params.id, req.auth!.role)
    successRes(res, { deleted: true })
  } catch (e) { handleRouteError(res, e) }
})

export { router as invoicesRouter }
