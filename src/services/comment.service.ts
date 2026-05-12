import { prisma } from '../lib/db'
import { createError } from '../lib/api-response'
import { UserRole } from '@prisma/client'
import { createNotification } from './notification.service'
import type { CreateCommentInput, UpdateCommentInput } from '../validations/comment'

async function parseMentions(content: string, taskId: string, authorId: string) {
  const mentionPattern = /@(\w+)/g
  const matches = [...content.matchAll(mentionPattern)]
  if (!matches.length) return

  const names = [...new Set(matches.map((m) => m[1]))]
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { title: true, projectId: true } })
  if (!task) return

  const author = await prisma.user.findUnique({ where: { id: authorId }, select: { name: true } })

  for (const name of names) {
    const mentioned = await prisma.user.findFirst({
      where: { name: { contains: name, mode: 'insensitive' }, deletedAt: null, isActive: true },
      select: { id: true },
    })
    if (mentioned && mentioned.id !== authorId) {
      await createNotification({
        userId: mentioned.id,
        type: 'MENTION',
        message: `${author?.name ?? 'Someone'} mentioned you in "${task.title}"`,
        link: `/projects/${task.projectId}`,
      })
    }
  }
}

export async function addComment(taskId: string, authorId: string, data: CreateCommentInput) {
  const task = await prisma.task.findUnique({ where: { id: taskId, deletedAt: null }, select: { id: true } })
  if (!task) throw createError('Task not found', 404)

  const comment = await prisma.comment.create({
    data: { taskId, authorId, content: data.content },
    select: {
      id: true, content: true, createdAt: true, updatedAt: true, deletedAt: true,
      author: { select: { id: true, name: true, avatar: true } },
    },
  })

  await parseMentions(data.content, taskId, authorId)
  return comment
}

export async function updateComment(commentId: string, authorId: string, data: UpdateCommentInput) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId, deletedAt: null } })
  if (!comment) throw createError('Comment not found', 404)
  if (comment.authorId !== authorId) throw createError('Access denied', 403)

  return prisma.comment.update({
    where: { id: commentId },
    data: { content: data.content },
    select: {
      id: true, content: true, createdAt: true, updatedAt: true, deletedAt: true,
      author: { select: { id: true, name: true, avatar: true } },
    },
  })
}

export async function softDeleteComment(commentId: string, requesterId: string, requesterRole: UserRole) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId, deletedAt: null } })
  if (!comment) throw createError('Comment not found', 404)

  const isAdmin = requesterRole === UserRole.ADMIN
  if (!isAdmin && comment.authorId !== requesterId) throw createError('Access denied', 403)

  await prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } })
}
