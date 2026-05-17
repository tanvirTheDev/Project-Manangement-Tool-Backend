import { prisma } from '../lib/db'
import { createError } from '../lib/api-response'
import { NotificationType } from '@prisma/client'
import { Resend } from 'resend'
import { env } from '../lib/env'
import {
  getTaskAssignedHtml, getMentionHtml, getTaskDoneHtml, getMemberAddedHtml,
} from '../emails/notification'
import { pushToUser } from '../lib/sse.service'

const resend = new Resend(env.RESEND_API_KEY)

const notificationSelect = {
  id: true, type: true, message: true, link: true, isRead: true, createdAt: true,
} as const

async function sendNotificationEmail(
  userId: string,
  type: NotificationType,
  message: string,
  link: string,
  extra?: Record<string, string>
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
    if (!user) return

    const frontendBase = env.FRONTEND_URL
    const fullLink = link.startsWith('http') ? link : `${frontendBase}${link}`

    let subject = ''
    let html = ''

    if (type === NotificationType.TASK_ASSIGNED) {
      subject = `You've been assigned: ${extra?.taskTitle ?? 'a task'}`
      html = getTaskAssignedHtml({
        recipientName: user.name,
        assignerName: extra?.assignerName ?? 'Someone',
        taskTitle: extra?.taskTitle ?? 'a task',
        taskLink: fullLink,
        projectName: extra?.projectName ?? 'a project',
      })
    } else if (type === NotificationType.MENTION) {
      subject = `${extra?.mentionerName ?? 'Someone'} mentioned you in ${extra?.taskTitle ?? 'a task'}`
      html = getMentionHtml({
        recipientName: user.name,
        mentionerName: extra?.mentionerName ?? 'Someone',
        taskTitle: extra?.taskTitle ?? 'a task',
        taskLink: fullLink,
        commentPreview: extra?.commentPreview ?? message,
      })
    } else if (type === NotificationType.TASK_DONE) {
      subject = `Task completed: ${extra?.taskTitle ?? 'a task'}`
      html = getTaskDoneHtml({
        recipientName: user.name,
        completedByName: extra?.completedByName ?? 'Someone',
        taskTitle: extra?.taskTitle ?? 'a task',
        taskLink: fullLink,
        projectName: extra?.projectName ?? 'a project',
      })
    } else if (type === NotificationType.MEMBER_ADDED) {
      subject = `New member added to ${extra?.projectName ?? 'your project'}`
      html = getMemberAddedHtml({
        recipientName: user.name,
        newMemberName: extra?.newMemberName ?? 'Someone',
        projectName: extra?.projectName ?? 'a project',
        projectLink: fullLink,
      })
    } else {
      return
    }

    const { error } = await resend.emails.send({ from: env.FROM_EMAIL, to: user.email, subject, html })
    if (error) console.error('[Resend] notification email failed:', error)
  } catch (err) {
    console.error('[notification email] error:', err)
  }
}

export async function createNotification(params: {
  userId: string
  type: NotificationType
  message: string
  link?: string
  emailExtra?: Record<string, string>
}): Promise<void> {
  const link = params.link ?? ''
  const saved = await prisma.notification.create({
    data: { userId: params.userId, type: params.type, message: params.message, link },
    select: { id: true, type: true, message: true, link: true, isRead: true, createdAt: true },
  })
  // Push to open SSE connections in real-time
  pushToUser(params.userId, 'notification', saved)
  // Fire email async — never block the main flow
  void sendNotificationEmail(params.userId, params.type, params.message, link, params.emailExtra)
}

export async function getUserNotifications(userId: string, unreadOnly: boolean) {
  const where = { userId, ...(unreadOnly ? { isRead: false } : {}) }

  const notifications = await prisma.notification.findMany({
    where,
    select: notificationSelect,
    orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
    take: 50,
  })

  const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } })
  const total = await prisma.notification.count({ where: { userId } })

  return { notifications, meta: { unreadCount, total } }
}

export async function markRead(notificationId: string, requesterId: string) {
  const notif = await prisma.notification.findUnique({ where: { id: notificationId } })
  if (!notif) throw createError('Notification not found', 404)
  if (notif.userId !== requesterId) throw createError('Access denied', 403)

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
    select: notificationSelect,
  })
}

export async function markAllRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  })
  return { updatedCount: result.count }
}
