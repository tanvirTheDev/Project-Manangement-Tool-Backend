import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createHash, randomBytes } from 'crypto'
import { prisma } from '../lib/db'
import { env } from '../lib/env'
import { createError } from '../lib/api-response'
import { sendInviteEmail, sendResetEmail } from '../emails'
import type { InviteInput } from '../validations/auth'
import type { UserRole } from '@prisma/client'

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

function signAccessToken(userId: string, role: UserRole): string {
  return jwt.sign({ userId, role }, env.JWT_SECRET, { expiresIn: '15m' })
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export async function login(
  email: string,
  password: string
): Promise<{
  tokens: TokenPair
  user: { id: string; name: string; email: string; role: UserRole; avatar: string | null }
}> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase(), deletedAt: null },
  })

  if (!user) throw createError('Invalid email or password', 401)
  if (!user.isActive) throw createError('Account has been deactivated', 401)

  const match = await bcrypt.compare(password, user.passwordHash)
  if (!match) throw createError('Invalid email or password', 401)

  const rawRefresh = randomBytes(32).toString('hex')

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawRefresh),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
  ])

  return {
    tokens: { accessToken: signAccessToken(user.id, user.role), refreshToken: rawRefresh },
    user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
  }
}

export async function refreshAccessToken(rawRefreshToken: string): Promise<string> {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawRefreshToken) },
    include: { user: { select: { id: true, role: true, isActive: true, deletedAt: true } } },
  })

  if (!record) throw createError('Invalid refresh token', 401)
  if (record.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: record.id } })
    throw createError('Refresh token expired', 401)
  }
  if (!record.user.isActive || record.user.deletedAt) {
    throw createError('Account has been deactivated', 401)
  }

  return signAccessToken(record.user.id, record.user.role)
}

export async function logout(userId: string, rawRefreshToken?: string): Promise<void> {
  if (rawRefreshToken) {
    await prisma.refreshToken.deleteMany({
      where: { tokenHash: hashToken(rawRefreshToken), userId },
    })
  } else {
    await prisma.refreshToken.deleteMany({ where: { userId } })
  }
}

export async function sendInvite(data: InviteInput, adminId: string): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase(), deletedAt: null },
  })
  if (existing) throw createError('A user with this email already exists', 409)

  const activeInvite = await prisma.inviteToken.findFirst({
    where: { email: data.email.toLowerCase(), used: false, expiresAt: { gt: new Date() } },
  })
  if (activeInvite) throw createError('An active invitation already exists for this email', 409)

  const token = randomBytes(32).toString('hex')
  await prisma.inviteToken.create({
    data: {
      email: data.email.toLowerCase(),
      token,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  })

  const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { name: true } })
  const inviteUrl = `${env.FRONTEND_URL}/set-password?token=${token}`

  await sendInviteEmail(data.email, {
    recipientName: data.name,
    inviteUrl,
    senderName: admin?.name ?? 'DataFever Admin',
  })
}

export async function setPassword(token: string, password: string): Promise<void> {
  const invite = await prisma.inviteToken.findUnique({ where: { token } })
  if (!invite) throw createError('Invalid or expired invitation token', 400)
  if (invite.used) throw createError('This invitation has already been used', 400)
  if (invite.expiresAt < new Date()) throw createError('Invitation token has expired', 400)

  const existingUser = await prisma.user.findUnique({ where: { email: invite.email, deletedAt: null } })
  if (existingUser) throw createError('User already exists with this email', 409)

  const passwordHash = await bcrypt.hash(password, 10)

  await prisma.$transaction([
    prisma.user.create({ data: { email: invite.email, passwordHash, name: '' } }),
    prisma.inviteToken.update({ where: { id: invite.id }, data: { used: true } }),
  ])
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase(), deletedAt: null, isActive: true },
  })
  if (!user) return // silent — prevent email enumeration

  const token = randomBytes(32).toString('hex')
  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
  })

  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`
  await sendResetEmail(email, { userName: user.name || email, resetUrl })
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } })
  if (!record) throw createError('Invalid or expired reset token', 400)
  if (record.used) throw createError('This reset token has already been used', 400)
  if (record.expiresAt < new Date()) throw createError('Reset token has expired', 400)

  const passwordHash = await bcrypt.hash(password, 10)

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
    prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
  ])
}
