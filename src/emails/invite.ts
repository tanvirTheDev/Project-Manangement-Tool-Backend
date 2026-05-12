export interface InviteEmailProps {
  recipientName: string
  inviteUrl: string
  senderName: string
  expiresIn?: string
}

export function getInviteEmailHtml({
  recipientName,
  inviteUrl,
  senderName,
  expiresIn = '48 hours',
}: InviteEmailProps): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>You're invited to DataFever Hub</title></head>
<body style="font-family:Inter,-apple-system,sans-serif;background:#f9fafb;margin:0;padding:40px 20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#4F46E5;padding:32px 40px;">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">DataFever Hub</h1>
    </div>
    <div style="padding:40px;">
      <h2 style="color:#111827;margin:0 0 16px 0;font-size:20px;">You've been invited!</h2>
      <p style="color:#374151;line-height:1.6;margin:0 0 16px 0;">Hi ${recipientName},</p>
      <p style="color:#374151;line-height:1.6;margin:0 0 24px 0;">
        <strong>${senderName}</strong> has invited you to join DataFever Hub — the internal management platform for DataFever Technology.
      </p>
      <a href="${inviteUrl}" style="display:inline-block;background:#4F46E5;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:16px;">Set Your Password</a>
      <p style="color:#6B7280;font-size:14px;margin:24px 0 0 0;">This link expires in ${expiresIn}. If you did not expect this invitation, you can safely ignore this email.</p>
    </div>
    <div style="background:#f9fafb;padding:20px 40px;border-top:1px solid #E5E7EB;">
      <p style="color:#9CA3AF;font-size:12px;margin:0;">© DataFever Technology · Narayanganj, Bangladesh</p>
    </div>
  </div>
</body>
</html>`
}
