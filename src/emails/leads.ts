interface LeadEmailProps {
  recipientName: string
  companyName: string
  senderName: string
  senderPhone: string
}

interface FollowupProps extends LeadEmailProps {
  previousContactDate: string
}

interface ProposalProps extends LeadEmailProps {
  proposalSummary: string
  validUntil: string
}

function baseStyle(): string {
  return `font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;`
}

function footer(senderName: string, senderPhone: string): string {
  return `
    <div style="margin-top:32px; padding-top:16px; border-top:1px solid #e5e7eb; font-size:13px; color:#6b7280;">
      <p style="margin:0;"><strong>${senderName}</strong></p>
      <p style="margin:4px 0;">DataFever Technology</p>
      <p style="margin:0;">📞 ${senderPhone} | 🌐 datafever.com</p>
    </div>`
}

export function getGarmentsIntroHtml({ recipientName, companyName, senderName, senderPhone }: LeadEmailProps): string {
  return `<div style="${baseStyle()}">
    <div style="background:#1d4ed8;padding:24px;border-radius:8px 8px 0 0;">
      <h1 style="color:#fff;margin:0;font-size:22px;">DataFever Technology</h1>
      <p style="color:#bfdbfe;margin:4px 0 0;font-size:14px;">Garments ERP Solution</p>
    </div>
    <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-radius:0 0 8px 8px;">
      <p>Dear <strong>${recipientName}</strong>,</p>
      <p>I hope this message finds you well. I'm reaching out from <strong>DataFever Technology</strong> regarding our specialized <strong>Garments ERP Solution</strong> designed specifically for the RMG industry.</p>
      <p>Our system covers the complete production lifecycle:</p>
      <ul style="line-height:1.8;">
        <li>📦 Inventory & Raw Material Management</li>
        <li>🏭 Production Planning & Monitoring</li>
        <li>👷 HR & Attendance Management</li>
        <li>💰 Payroll Processing</li>
        <li>📊 Real-time Reporting & Analytics</li>
      </ul>
      <p>We've helped multiple garments factories in Bangladesh streamline their operations and reduce manual errors by up to 70%.</p>
      <p>I'd love to schedule a <strong>free 15-minute demo</strong> for <strong>${companyName}</strong> at your convenience.</p>
      <a href="mailto:${senderPhone}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:8px;">Schedule a Demo</a>
      ${footer(senderName, senderPhone)}
    </div>
  </div>`
}

export function getSchoolIntroHtml({ recipientName, companyName, senderName, senderPhone }: LeadEmailProps): string {
  return `<div style="${baseStyle()}">
    <div style="background:#0f766e;padding:24px;border-radius:8px 8px 0 0;">
      <h1 style="color:#fff;margin:0;font-size:22px;">DataFever Technology</h1>
      <p style="color:#99f6e4;margin:4px 0 0;font-size:14px;">School Management System</p>
    </div>
    <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-radius:0 0 8px 8px;">
      <p>Dear <strong>${recipientName}</strong>,</p>
      <p>I'm writing from <strong>DataFever Technology</strong> to introduce our comprehensive <strong>School Management System</strong> built for modern educational institutions.</p>
      <p>Key features for <strong>${companyName}</strong>:</p>
      <ul style="line-height:1.8;">
        <li>📚 Student Admission & Records Management</li>
        <li>💳 Fee Collection & Payment Tracking</li>
        <li>✅ Daily Attendance (Students & Staff)</li>
        <li>📝 Exam & Result Management</li>
        <li>👨‍🏫 Staff & Payroll Management</li>
        <li>📱 Parent Communication Portal</li>
      </ul>
      <p>We'd love to offer you a <strong>free demo</strong> tailored to your institution's needs.</p>
      <a href="mailto:${senderPhone}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:8px;">Book a Free Demo</a>
      ${footer(senderName, senderPhone)}
    </div>
  </div>`
}

export function getFollowupHtml({ recipientName, companyName, previousContactDate, senderName, senderPhone }: FollowupProps): string {
  return `<div style="${baseStyle()}">
    <div style="background:#7c3aed;padding:24px;border-radius:8px 8px 0 0;">
      <h1 style="color:#fff;margin:0;font-size:22px;">DataFever Technology</h1>
      <p style="color:#ddd6fe;margin:4px 0 0;font-size:14px;">Following Up</p>
    </div>
    <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-radius:0 0 8px 8px;">
      <p>Dear <strong>${recipientName}</strong>,</p>
      <p>I'm following up on our conversation on <strong>${previousContactDate}</strong> regarding our software solution for <strong>${companyName}</strong>.</p>
      <p>I wanted to check if you had any questions or if there's anything more I can clarify about how our system can benefit your business.</p>
      <p>We're happy to:</p>
      <ul style="line-height:1.8;">
        <li>Provide a customized demo for your specific needs</li>
        <li>Share case studies from similar businesses</li>
        <li>Discuss pricing and implementation timelines</li>
      </ul>
      <p>Feel free to reply to this email or call me directly — I'm here to help.</p>
      ${footer(senderName, senderPhone)}
    </div>
  </div>`
}

export function getProposalSentHtml({ recipientName, companyName, proposalSummary, validUntil, senderName, senderPhone }: ProposalProps): string {
  return `<div style="${baseStyle()}">
    <div style="background:#b45309;padding:24px;border-radius:8px 8px 0 0;">
      <h1 style="color:#fff;margin:0;font-size:22px;">DataFever Technology</h1>
      <p style="color:#fde68a;margin:4px 0 0;font-size:14px;">Proposal for ${companyName}</p>
    </div>
    <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-radius:0 0 8px 8px;">
      <p>Dear <strong>${recipientName}</strong>,</p>
      <p>Please find below our proposal for <strong>${companyName}</strong>:</p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:16px 0;">
        <p style="margin:0;white-space:pre-line;">${proposalSummary}</p>
      </div>
      <p><strong>This proposal is valid until: ${validUntil}</strong></p>
      <p>Next steps:</p>
      <ol style="line-height:1.8;">
        <li>Review the proposal</li>
        <li>Schedule a call to discuss any questions</li>
        <li>Confirm acceptance to begin implementation planning</li>
      </ol>
      <p>We look forward to partnering with ${companyName}. Please don't hesitate to reach out.</p>
      ${footer(senderName, senderPhone)}
    </div>
  </div>`
}

export const LEAD_EMAIL_TEMPLATES: Record<string, { defaultSubject: string }> = {
  garments_intro: { defaultSubject: 'DataFever Technology — Garments ERP Solution' },
  school_intro: { defaultSubject: 'DataFever Technology — School Management System' },
  followup: { defaultSubject: 'Following up — DataFever Technology' },
  proposal_sent: { defaultSubject: 'Proposal from DataFever Technology' },
}

export function renderLeadEmailHtml(
  templateKey: string,
  lead: { contactPerson: string; companyName: string; lastContactedAt: Date | null },
  sender: { name: string },
  senderPhone = '01XXXXXXXXX'
): string | null {
  const props = {
    recipientName: lead.contactPerson,
    companyName: lead.companyName,
    senderName: sender.name,
    senderPhone,
  }
  switch (templateKey) {
    case 'garments_intro': return getGarmentsIntroHtml(props)
    case 'school_intro': return getSchoolIntroHtml(props)
    case 'followup': return getFollowupHtml({
      ...props,
      previousContactDate: lead.lastContactedAt
        ? lead.lastContactedAt.toLocaleDateString('en-GB')
        : 'our previous conversation',
    })
    case 'proposal_sent': return getProposalSentHtml({
      ...props,
      proposalSummary: 'Please see the attached proposal for details.',
      validUntil: new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-GB'),
    })
    default: return null
  }
}
