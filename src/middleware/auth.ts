import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { UserRole } from '@prisma/client'
import { env } from '../lib/env'
import { prisma } from '../lib/db'
import { createError, errorRes } from '../lib/api-response'

export interface AuthPayload {
  userId: string
  role: UserRole
}

export function verifyAccessToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as AuthPayload
  } catch {
    return null
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization
    let token: string | undefined

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7)
    } else {
      token = req.cookies['df-token'] as string | undefined
    }

    if (!token) {
      errorRes(res, 'Unauthorized', 401)
      return
    }

    const payload = verifyAccessToken(token)
    if (!payload) {
      errorRes(res, 'Unauthorized', 401)
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId, deletedAt: null },
      select: { isActive: true },
    })

    if (!user) {
      errorRes(res, 'Unauthorized', 401)
      return
    }

    if (!user.isActive) {
      errorRes(res, 'Account has been deactivated', 401)
      return
    }

    req.auth = payload
    next()
  } catch (error) {
    console.error('[requireAuth]', error)
    errorRes(res, 'Unauthorized', 401)
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      errorRes(res, 'Unauthorized', 401)
      return
    }
    if (!roles.includes(req.auth.role)) {
      errorRes(res, 'Forbidden', 403)
      return
    }
    next()
  }
}
