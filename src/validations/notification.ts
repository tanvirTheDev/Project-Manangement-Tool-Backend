import { z } from 'zod'

export const notificationQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().default(false),
})

export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>
