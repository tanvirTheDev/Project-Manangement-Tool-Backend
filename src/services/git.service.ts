import { createHmac, timingSafeEqual } from 'crypto'
import { prisma } from '../lib/db'
import { createError } from '../lib/api-response'
import { UserRole, GitEventType } from '@prisma/client'
import { createNotification } from './notification.service'
import type { CreateGitLinkInput } from '../validations/git'

// UUID pattern after '#' in commit messages / PR titles
const TASK_ID_REGEX = /#([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi

export function verifyGithubSignature(payload: string, signature: string, secret: string): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

function extractTaskIds(text: string): string[] {
  const ids: string[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(TASK_ID_REGEX.source, 'gi')
  while ((match = re.exec(text)) !== null) ids.push(match[1])
  return [...new Set(ids)]
}

function repoNameFromUrl(url: string): string {
  return url.replace(/\.git$/, '').split('/').slice(-2).join('/')
}

async function linkAndCreateEvent(params: {
  taskId: string
  repoName: string
  repoUrl: string
  provider: string
  type: GitEventType
  title: string
  url: string
  authorName: string
  sha?: string
  prNumber?: number
}) {
  const task = await prisma.task.findFirst({
    where: { id: params.taskId, deletedAt: null },
    include: { assignee: { select: { id: true } } },
  })
  if (!task) return

  // Find or create GitLink (upsert by taskId + repoName)
  const gitLink = await prisma.gitLink.upsert({
    where: { taskId_repoName: { taskId: params.taskId, repoName: params.repoName } },
    create: {
      taskId: params.taskId,
      provider: params.provider,
      repoName: params.repoName,
      repoUrl: params.repoUrl,
      createdById: (await prisma.user.findFirst({ where: { role: UserRole.ADMIN } }))?.id ?? params.taskId,
    },
    update: {},
  })

  await prisma.gitEvent.create({
    data: {
      gitLinkId: gitLink.id,
      taskId: params.taskId,
      type: params.type,
      title: params.title,
      url: params.url,
      authorName: params.authorName,
      sha: params.sha,
      prNumber: params.prNumber,
    },
  })

  // ActivityLog
  const action = params.type === GitEventType.COMMIT ? 'GIT_COMMIT'
    : params.type === GitEventType.PULL_REQUEST_OPENED ? 'GIT_PR_OPENED'
    : params.type === GitEventType.PULL_REQUEST_MERGED ? 'GIT_PR_MERGED'
    : null

  if (action) {
    const logUser = await prisma.user.findFirst({ where: { role: UserRole.ADMIN }, select: { id: true } })
    if (logUser) {
      await prisma.activityLog.create({
        data: {
          taskId: params.taskId,
          userId: logUser.id,
          action,
          newValue: params.sha ?? (params.prNumber ? `#${params.prNumber} ${params.title}` : params.title),
        },
      })
    }
  }

  // Notify assignee on PR merge
  if (params.type === GitEventType.PULL_REQUEST_MERGED && task.assigneeId) {
    await createNotification({
      userId: task.assigneeId,
      type: 'MENTION',
      message: `PR merged for task: ${task.title}`,
      link: `/projects/${task.projectId}`,
    })
  }
}

export async function processGithubWebhook(payload: Record<string, unknown>, eventHeader: string) {
  const repoUrl: string = (payload.repository as Record<string, unknown>)?.html_url as string ?? ''
  const repoName = repoNameFromUrl(repoUrl)
  const provider = 'github'

  if (eventHeader === 'push') {
    const commits = (payload.commits as Array<Record<string, unknown>>) ?? []
    for (const commit of commits) {
      const message = commit.message as string ?? ''
      const taskIds = extractTaskIds(message)
      for (const taskId of taskIds) {
        await linkAndCreateEvent({
          taskId,
          repoName,
          repoUrl,
          provider,
          type: GitEventType.COMMIT,
          title: message.split('\n')[0].slice(0, 200),
          url: commit.url as string ?? '',
          authorName: (commit.author as Record<string, unknown>)?.name as string ?? 'unknown',
          sha: (commit.id as string)?.slice(0, 7),
        })
      }
    }
  } else if (eventHeader === 'pull_request') {
    const pr = payload.pull_request as Record<string, unknown>
    const action = payload.action as string
    const title = pr?.title as string ?? ''
    const taskIds = extractTaskIds(title)
    const prUrl = pr?.html_url as string ?? ''
    const authorName = (pr?.user as Record<string, unknown>)?.login as string ?? 'unknown'
    const prNumber = pr?.number as number

    let type: GitEventType | null = null
    if (action === 'opened') type = GitEventType.PULL_REQUEST_OPENED
    else if (action === 'closed' && pr?.merged) type = GitEventType.PULL_REQUEST_MERGED
    else if (action === 'closed') type = GitEventType.PULL_REQUEST_CLOSED

    if (type) {
      for (const taskId of taskIds) {
        await linkAndCreateEvent({ taskId, repoName, repoUrl, provider, type, title, url: prUrl, authorName, prNumber })
      }
    }
  }
}

export async function getGitLinksForTask(taskId: string) {
  return prisma.gitLink.findMany({
    where: { taskId },
    include: {
      createdBy: { select: { id: true, name: true } },
      events: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
    orderBy: { createdAt: 'asc' },
  })
}

export async function createManualGitLink(taskId: string, data: CreateGitLinkInput, userId: string, userRole: UserRole) {
  if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGER) {
    throw createError('Only ADMIN or MANAGER can link repos', 403)
  }
  const task = await prisma.task.findFirst({ where: { id: taskId, deletedAt: null } })
  if (!task) throw createError('Task not found', 404)

  const repoName = repoNameFromUrl(data.repoUrl)

  return prisma.gitLink.upsert({
    where: { taskId_repoName: { taskId, repoName } },
    create: { taskId, provider: data.provider, repoName, repoUrl: data.repoUrl, branchName: data.branchName, createdById: userId },
    update: { branchName: data.branchName },
    include: { createdBy: { select: { id: true, name: true } }, events: { orderBy: { createdAt: 'desc' }, take: 10 } },
  })
}

export async function deleteGitLink(taskId: string, linkId: string, userRole: UserRole) {
  if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGER) {
    throw createError('Only ADMIN or MANAGER can remove git links', 403)
  }
  const link = await prisma.gitLink.findFirst({ where: { id: linkId, taskId } })
  if (!link) throw createError('Git link not found', 404)
  await prisma.gitEvent.deleteMany({ where: { gitLinkId: linkId } })
  await prisma.gitLink.delete({ where: { id: linkId } })
}
