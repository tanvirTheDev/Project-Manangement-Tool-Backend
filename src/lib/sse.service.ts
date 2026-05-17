import type { Response } from 'express'

// In-memory SSE registry: userId → set of Express Response objects (one per open browser tab).
// Multi-region or multi-instance deployments require Redis pub/sub (e.g. Upstash Redis)
// to broadcast across instances — upgrade in v1.2.
const registry = new Map<string, Set<Response>>()

export function registerStream(userId: string, res: Response): void {
  if (!registry.has(userId)) registry.set(userId, new Set())
  registry.get(userId)!.add(res)
}

export function unregisterStream(userId: string, res: Response): void {
  registry.get(userId)?.delete(res)
}

export function pushToUser(userId: string, event: string, data: object): void {
  const clients = registry.get(userId)
  if (!clients) return
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of clients) {
    try {
      res.write(payload)
    } catch {
      unregisterStream(userId, res)
    }
  }
}
