import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { requireRole } from '../middleware/auth'
import {
  loginSchema,
  inviteSchema,
  setPasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validations/auth'
import {
  login,
  refreshAccessToken,
  logout,
  sendInvite,
  setPassword,
  forgotPassword,
  resetPassword,
} from '../services/auth.service'
import { successRes, errorRes, handleRouteError } from '../lib/api-response'
import { checkRateLimit, getClientIp } from '../lib/rate-limit'

const router = Router()

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const ip = getClientIp(req)
    if (!checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000)) {
      errorRes(res, 'Too many login attempts. Try again in 15 minutes.', 429)
      return
    }

    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      errorRes(res, parsed.error.issues[0].message, 400)
      return
    }

    const { tokens, user } = await login(parsed.data.email, parsed.data.password)
    const isProduction = process.env.NODE_ENV === 'production'

    res.cookie('df-token', tokens.accessToken, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    })

    res.cookie('df-refresh', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    })

    successRes(res, { user, accessToken: tokens.accessToken })
  } catch (error) {
    handleRouteError(res, error)
  }
})

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies['df-refresh'] as string | undefined
    if (!refreshToken) {
      errorRes(res, 'No refresh token provided', 401)
      return
    }

    const accessToken = await refreshAccessToken(refreshToken)
    const isProduction = process.env.NODE_ENV === 'production'

    res.cookie('df-token', accessToken, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    })

    successRes(res, { accessToken })
  } catch (error) {
    handleRouteError(res, error)
  }
})

router.post('/logout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies['df-refresh'] as string | undefined
    await logout(req.auth!.userId, refreshToken)

    res.clearCookie('df-token', { path: '/' })
    res.clearCookie('df-refresh', { path: '/' })

    successRes(res, { message: 'Logged out successfully' })
  } catch (error) {
    res.clearCookie('df-token', { path: '/' })
    res.clearCookie('df-refresh', { path: '/' })
    successRes(res, { message: 'Logged out' })
  }
})

router.post(
  '/invite',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = inviteSchema.safeParse(req.body)
      if (!parsed.success) {
        errorRes(res, parsed.error.issues[0].message, 400)
        return
      }
      await sendInvite(parsed.data, req.auth!.userId)
      successRes(res, { message: 'Invitation sent successfully' }, 201)
    } catch (error) {
      handleRouteError(res, error)
    }
  }
)

router.post('/set-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = setPasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      errorRes(res, parsed.error.issues[0].message, 400)
      return
    }
    await setPassword(parsed.data.token, parsed.data.password)
    successRes(res, { message: 'Password set successfully. You can now log in.' })
  } catch (error) {
    handleRouteError(res, error)
  }
})

router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      errorRes(res, parsed.error.issues[0].message, 400)
      return
    }
    await forgotPassword(parsed.data.email)
    successRes(res, {
      message: 'If that email is registered, you will receive a reset link shortly.',
    })
  } catch (error) {
    handleRouteError(res, error)
  }
})

router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      errorRes(res, parsed.error.issues[0].message, 400)
      return
    }
    await resetPassword(parsed.data.token, parsed.data.password)
    successRes(res, { message: 'Password reset successfully. You can now log in.' })
  } catch (error) {
    handleRouteError(res, error)
  }
})

export { router as authRouter }
