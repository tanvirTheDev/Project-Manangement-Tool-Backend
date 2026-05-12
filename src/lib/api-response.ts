import { Response } from 'express'
import { Prisma } from '@prisma/client'

export function successRes<T>(
  res: Response,
  data: T,
  status = 200,
  meta?: Record<string, unknown>
): Response {
  return res.status(status).json({ success: true, data, meta })
}

export function errorRes(res: Response, message: string, status: number): Response {
  return res.status(status).json({ success: false, error: message })
}

export function createError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode })
}

export function handleRouteError(res: Response, error: unknown): Response {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P1017') {
    console.error('[DB] Neon connection reset — server restarting connection')
    return errorRes(res, 'Database temporarily unavailable, please retry', 503)
  }
  if (error instanceof Error) {
    const e = error as Error & { statusCode?: number }
    if (e.statusCode === 401) return errorRes(res, e.message || 'Unauthorized', 401)
    if (e.statusCode === 403) return errorRes(res, e.message || 'Forbidden', 403)
    if (e.statusCode === 404) return errorRes(res, e.message || 'Not found', 404)
    if (e.statusCode === 409) return errorRes(res, e.message || 'Conflict', 409)
    if (e.statusCode === 400) return errorRes(res, e.message || 'Bad request', 400)
    if (e.statusCode === 429) return errorRes(res, 'Too many requests', 429)
  }
  console.error('[Route Error]', error)
  return errorRes(res, 'Internal server error', 500)
}
