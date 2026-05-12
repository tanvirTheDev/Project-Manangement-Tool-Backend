import { prisma } from '../lib/db'
import { NotificationType } from '@prisma/client'

export async function createNotification(params: {
  userId: string
  type: NotificationType
  message: string
  link?: string
}): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      message: params.message,
      link: params.link,
    },
  })
}
