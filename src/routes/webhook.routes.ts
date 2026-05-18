import { Router, Request, Response } from 'express'
import { successRes, errorRes } from '../lib/api-response'
import { verifyGithubSignature, processGithubWebhook } from '../services/git.service'

const router = Router()

// POST /api/webhooks/github — no auth, protected by HMAC-SHA256 signature
// express.raw() middleware applied before this router in index.ts — req.body is a Buffer
router.post('/github', async (req: Request, res: Response): Promise<void> => {
  try {
    const secret = process.env.GITHUB_WEBHOOK_SECRET
    if (!secret) { errorRes(res, 'Webhook secret not configured', 500); return }

    const signature = req.headers['x-hub-signature-256'] as string | undefined
    if (!signature) { errorRes(res, 'Missing signature', 401); return }

    const rawBody = req.body as Buffer
    if (!Buffer.isBuffer(rawBody)) { errorRes(res, 'Unexpected body format', 400); return }

    if (!verifyGithubSignature(rawBody.toString('utf8'), signature, secret)) {
      errorRes(res, 'Invalid signature', 401)
      return
    }

    const payload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>
    const event = req.headers['x-github-event'] as string ?? ''
    await processGithubWebhook(payload, event)

    successRes(res, { received: true })
  } catch (e) {
    console.error('Webhook error:', e)
    successRes(res, { received: true }) // always 200 to GitHub
  }
})

export { router as webhookRouter }
