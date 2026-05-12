import { Router, Request, Response } from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/auth'
import { taskFiltersSchema, createTaskSchema, updateTaskSchema } from '../validations/task'
import { createCommentSchema, updateCommentSchema } from '../validations/comment'
import {
  getTasks, getMyTasks, getTaskById, createTask, updateTask, softDeleteTask,
  addLink, deleteLink,
} from '../services/task.service'
import { addComment, updateComment, softDeleteComment } from '../services/comment.service'
import { uploadAttachment, deleteAttachment } from '../services/attachment.service'
import { successRes, errorRes, handleRouteError } from '../lib/api-response'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 26214400 } })

// GET /api/tasks/my
router.get('/my', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await getMyTasks(req.auth!.userId)
    successRes(res, result)
  } catch (error) { handleRouteError(res, error) }
})

// GET /api/tasks/:id
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const task = await getTaskById(req.params.id, req.auth!.userId, req.auth!.role)
    successRes(res, task)
  } catch (error) { handleRouteError(res, error) }
})

// PATCH /api/tasks/:id
router.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = updateTaskSchema.safeParse(req.body)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const task = await updateTask(req.params.id, parsed.data, req.auth!.userId, req.auth!.role)
    successRes(res, task)
  } catch (error) { handleRouteError(res, error) }
})

// DELETE /api/tasks/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await softDeleteTask(req.params.id, req.auth!.userId, req.auth!.role)
    successRes(res, { message: 'Task deleted' })
  } catch (error) { handleRouteError(res, error) }
})

// POST /api/tasks/:id/comments
router.post('/:id/comments', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createCommentSchema.safeParse(req.body)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const comment = await addComment(req.params.id, req.auth!.userId, parsed.data)
    successRes(res, comment, 201)
  } catch (error) { handleRouteError(res, error) }
})

// PATCH /api/tasks/:id/comments/:cid
router.patch('/:id/comments/:cid', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = updateCommentSchema.safeParse(req.body)
    if (!parsed.success) { errorRes(res, parsed.error.issues[0].message, 400); return }
    const comment = await updateComment(req.params.cid, req.auth!.userId, parsed.data)
    successRes(res, comment)
  } catch (error) { handleRouteError(res, error) }
})

// DELETE /api/tasks/:id/comments/:cid
router.delete('/:id/comments/:cid', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await softDeleteComment(req.params.cid, req.auth!.userId, req.auth!.role)
    successRes(res, { message: 'Comment deleted' })
  } catch (error) { handleRouteError(res, error) }
})

// POST /api/tasks/:id/attachments
router.post('/:id/attachments', requireAuth, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) { errorRes(res, 'No file uploaded', 400); return }
    const attachment = await uploadAttachment(
      req.params.id,
      req.auth!.userId,
      req.auth!.role,
      {
        buffer: req.file.buffer,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      }
    )
    successRes(res, attachment, 201)
  } catch (error) { handleRouteError(res, error) }
})

// DELETE /api/tasks/:id/attachments/:aid
router.delete('/:id/attachments/:aid', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await deleteAttachment(req.params.aid, req.auth!.userId, req.auth!.role)
    successRes(res, { message: 'Attachment deleted' })
  } catch (error) { handleRouteError(res, error) }
})

// POST /api/tasks/:id/links
router.post('/:id/links', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, label } = req.body as { url?: string; label?: string }
    if (!url) { errorRes(res, 'URL is required', 400); return }
    const link = await addLink(req.params.id, { url, label }, req.auth!.userId, req.auth!.role)
    successRes(res, link, 201)
  } catch (error) { handleRouteError(res, error) }
})

// DELETE /api/tasks/:id/links/:lid
router.delete('/:id/links/:lid', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await deleteLink(req.params.lid, req.auth!.userId, req.auth!.role)
    successRes(res, { message: 'Link deleted' })
  } catch (error) { handleRouteError(res, error) }
})

export { router as tasksRouter }
