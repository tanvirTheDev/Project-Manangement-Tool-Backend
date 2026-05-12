import { Resend } from 'resend'
import { env } from '../lib/env'
import { getInviteEmailHtml, type InviteEmailProps } from './invite'
import { getResetPasswordEmailHtml, type ResetPasswordEmailProps } from './reset-password'

const resend = new Resend(env.RESEND_API_KEY)

export async function sendInviteEmail(to: string, props: InviteEmailProps): Promise<void> {
  const { data, error } = await resend.emails.send({
    from: env.FROM_EMAIL,
    to,
    subject: "You're invited to DataFever Hub",
    html: getInviteEmailHtml(props),
  })
  if (error) {
    console.error('[Resend] sendInviteEmail failed:', error)
    throw new Error(`Email delivery failed: ${error.message}`)
  }
  console.log('[Resend] invite sent, id:', data?.id)
}

export async function sendResetEmail(to: string, props: ResetPasswordEmailProps): Promise<void> {
  const { data, error } = await resend.emails.send({
    from: env.FROM_EMAIL,
    to,
    subject: 'Reset your DataFever Hub password',
    html: getResetPasswordEmailHtml(props),
  })
  if (error) {
    console.error('[Resend] sendResetEmail failed:', error)
    throw new Error(`Email delivery failed: ${error.message}`)
  }
  console.log('[Resend] reset email sent, id:', data?.id)
}
