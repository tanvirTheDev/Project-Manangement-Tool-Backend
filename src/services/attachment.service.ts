import { prisma } from '../lib/db'
import { createError } from '../lib/api-response'
import { UserRole } from '@prisma/client'
import { uploadFile, deleteImage } from '../lib/cloudinary'

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
]

const MAX_FILE_SIZE = 26214400 // 25 MB
const MAX_ATTACHMENTS_PER_TASK = 10

export async function uploadAttachment(
  taskId: string,
  uploaderId: string,
  requesterRole: UserRole,
  file: { buffer: Buffer; fileName: string; fileSize: number; mimeType: string }
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId, deletedAt: null },
    select: { id: true, projectId: true },
  })
  if (!task) throw createError('Task not found', 404)

  // Membership check for MEMBER role
  if (requesterRole === UserRole.MEMBER) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: task.projectId, userId: uploaderId } },
    })
    if (!member) throw createError('Access denied', 403)
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimeType)) throw createError('File type not allowed', 400)
  if (file.fileSize > MAX_FILE_SIZE) throw createError('File exceeds 25 MB limit', 400)

  const count = await prisma.attachment.count({ where: { taskId, deletedAt: null } })
  if (count >= MAX_ATTACHMENTS_PER_TASK) throw createError('Maximum 10 attachments per task', 400)

  const { url, publicId } = await uploadFile(file.buffer, file.fileName, file.mimeType)

  return prisma.attachment.create({
    data: {
      taskId,
      fileUrl: url,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      cloudinaryId: publicId,
      uploadedById: uploaderId,
    },
    select: {
      id: true, fileName: true, fileUrl: true, fileSize: true, mimeType: true,
      cloudinaryId: true, createdAt: true,
      uploadedBy: { select: { id: true, name: true } },
    },
  })
}

export async function deleteAttachment(attachmentId: string, requesterId: string, requesterRole: UserRole) {
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId, deletedAt: null } })
  if (!attachment) throw createError('Attachment not found', 404)

  const isAdmin = requesterRole === UserRole.ADMIN
  if (!isAdmin && attachment.uploadedById !== requesterId) throw createError('Access denied', 403)

  await deleteImage(attachment.cloudinaryId)
  await prisma.attachment.update({ where: { id: attachmentId }, data: { deletedAt: new Date() } })
}
