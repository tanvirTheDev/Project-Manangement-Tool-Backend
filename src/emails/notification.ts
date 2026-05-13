const BASE = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="font-family:Inter,-apple-system,sans-serif;background:#f9fafb;margin:0;padding:40px 20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#4F46E5;padding:24px 40px;">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">DataFever Hub</h1>
    </div>
    <div style="padding:32px 40px;">
      BODY
    </div>
    <div style="background:#f9fafb;padding:16px 40px;border-top:1px solid #E5E7EB;">
      <p style="color:#9CA3AF;font-size:12px;margin:0;">© DataFever Technology · Narayanganj, Bangladesh</p>
    </div>
  </div>
</body></html>`

function btn(href: string, text: string) {
  return `<a href="${href}" style="display:inline-block;background:#4F46E5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;margin-top:20px;">${text}</a>`
}

function wrap(body: string) {
  return BASE.replace('BODY', body)
}

export function getTaskAssignedHtml(p: {
  recipientName: string; assignerName: string; taskTitle: string; taskLink: string; projectName: string
}) {
  return wrap(`
    <h2 style="color:#111827;margin:0 0 12px 0;font-size:18px;">New task assigned</h2>
    <p style="color:#374151;line-height:1.6;margin:0 0 8px 0;">Hi ${p.recipientName},</p>
    <p style="color:#374151;line-height:1.6;margin:0 0 4px 0;">
      <strong>${p.assignerName}</strong> assigned you a task in <strong>${p.projectName}</strong>:
    </p>
    <p style="color:#111827;font-size:16px;font-weight:600;margin:12px 0;">"${p.taskTitle}"</p>
    ${btn(p.taskLink, 'View Task')}
  `)
}

export function getMentionHtml(p: {
  recipientName: string; mentionerName: string; taskTitle: string; taskLink: string; commentPreview: string
}) {
  return wrap(`
    <h2 style="color:#111827;margin:0 0 12px 0;font-size:18px;">You were mentioned</h2>
    <p style="color:#374151;line-height:1.6;margin:0 0 8px 0;">Hi ${p.recipientName},</p>
    <p style="color:#374151;line-height:1.6;margin:0 0 12px 0;">
      <strong>${p.mentionerName}</strong> mentioned you in <strong>"${p.taskTitle}"</strong>:
    </p>
    <blockquote style="border-left:3px solid #4F46E5;margin:0;padding:8px 16px;background:#f5f3ff;color:#374151;font-style:italic;">
      ${p.commentPreview}
    </blockquote>
    ${btn(p.taskLink, 'View Comment')}
  `)
}

export function getTaskDoneHtml(p: {
  recipientName: string; completedByName: string; taskTitle: string; taskLink: string; projectName: string
}) {
  return wrap(`
    <h2 style="color:#111827;margin:0 0 12px 0;font-size:18px;">Task completed ✓</h2>
    <p style="color:#374151;line-height:1.6;margin:0 0 8px 0;">Hi ${p.recipientName},</p>
    <p style="color:#374151;line-height:1.6;margin:0 0 4px 0;">
      <strong>${p.completedByName}</strong> marked your task as done in <strong>${p.projectName}</strong>:
    </p>
    <p style="color:#111827;font-size:16px;font-weight:600;margin:12px 0;">"${p.taskTitle}"</p>
    ${btn(p.taskLink, 'View Task')}
  `)
}

export function getMemberAddedHtml(p: {
  recipientName: string; newMemberName: string; projectName: string; projectLink: string
}) {
  return wrap(`
    <h2 style="color:#111827;margin:0 0 12px 0;font-size:18px;">New member joined your project</h2>
    <p style="color:#374151;line-height:1.6;margin:0 0 8px 0;">Hi ${p.recipientName},</p>
    <p style="color:#374151;line-height:1.6;margin:0;">
      <strong>${p.newMemberName}</strong> has been added to your project <strong>${p.projectName}</strong>.
    </p>
    ${btn(p.projectLink, 'View Project')}
  `)
}
