import nodemailer from 'nodemailer'

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const getAppUrl = () => (process.env.APP_URL || '').trim().replace(/\/$/, '')
const getSmtpPort = () => {
  const raw = (process.env.SMTP_PORT || '').trim()
  const port = raw ? Number.parseInt(raw, 10) : NaN
  return Number.isFinite(port) ? port : 587
}

const isSecure = () => String(process.env.SMTP_SECURE || '').trim().toLowerCase() === 'true'

let cachedTransporter

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter

  const host = (process.env.SMTP_HOST || '').trim()
  const user = (process.env.SMTP_USER || '').trim()
  const pass = (process.env.SMTP_PASS || '').trim()
  const port = getSmtpPort()
  const secure = isSecure()

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  })

  return cachedTransporter
}

const buildInviteEmail = ({ workspaceName, inviterName, role, inviteUrl }) => {
  const safeWorkspace = escapeHtml(workspaceName || 'TeamPad workspace')
  const safeInviter = escapeHtml(inviterName || 'Someone')
  const safeRole = role ? escapeHtml(role) : ''
  const safeInviteUrl = escapeHtml(inviteUrl)
  const subject = `You're invited to ${safeWorkspace} on TeamPad`
  const introText = inviterName
    ? `${safeInviter} invited you to join ${safeWorkspace} on TeamPad.`
    : `You have been invited to join ${safeWorkspace} on TeamPad.`
  const roleText = role ? `Role: ${role}` : ''

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2 style="margin: 0 0 12px;">Join ${safeWorkspace} on TeamPad</h2>
      <p style="margin: 0 0 12px;">${escapeHtml(introText)}</p>
      ${role ? `<p style="margin: 0 0 12px;"><strong>Role:</strong> ${safeRole}</p>` : ''}
      <p style="margin: 0 0 12px; font-size: 14px; color: #334155;">
        New to TeamPad? Create an account with this email, then open the invite link again.
      </p>
      <p style="margin: 0 0 16px;">
        <a href="${safeInviteUrl}" style="color: #0f172a; font-weight: 600; text-decoration: none;">
          Accept invite
        </a>
      </p>
      <p style="margin: 0; font-size: 12px; color: #555;">
        If you did not expect this invitation, you can safely ignore this email.
      </p>
    </div>
  `

  const text = [
    introText,
    roleText,
    'New to TeamPad? Create an account with this email, then open the invite link again.',
    `Accept invite: ${inviteUrl}`,
    'If you did not expect this invitation, you can safely ignore this email.',
  ]
    .filter(Boolean)
    .join('\n')

  return { subject, html, text }
}

const buildPasswordResetEmail = ({ resetUrl }) => {
  const safeResetUrl = escapeHtml(resetUrl)
  const subject = 'Reset your TeamPad password'
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2 style="margin: 0 0 12px;">Reset your TeamPad password</h2>
      <p style="margin: 0 0 12px;">
        We received a request to reset your password. If this was you, use the link below.
      </p>
      <p style="margin: 0 0 16px;">
        <a href="${safeResetUrl}" style="color: #0f172a; font-weight: 600; text-decoration: none;">
          Reset password
        </a>
      </p>
      <p style="margin: 0; font-size: 12px; color: #555;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `
  const text = [
    'We received a request to reset your password.',
    `Reset password: ${resetUrl}`,
    "If you didn't request this, you can safely ignore this email.",
  ].join('\n')
  return { subject, html, text }
}

export const sendWorkspaceInviteEmail = async ({ to, workspaceName, inviterName, role, token }) => {
  const host = (process.env.SMTP_HOST || '').trim()
  const from = (process.env.SMTP_FROM || '').trim()
  const appUrl = getAppUrl()
  if (!host || !from || !appUrl) {
    return { sent: false, skipped: true, reason: 'missing_config' }
  }

  const inviteUrl = `${appUrl}/invite/${token}`
  const { subject, html, text } = buildInviteEmail({ workspaceName, inviterName, role, inviteUrl })
  const transporter = getTransporter()
  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text,
  })

  return { sent: true, messageId: info?.messageId }
}

export const sendPasswordResetEmail = async ({ to, token }) => {
  const host = (process.env.SMTP_HOST || '').trim()
  const from = (process.env.SMTP_FROM || '').trim()
  const appUrl = getAppUrl()
  if (!host || !from || !appUrl) {
    return { sent: false, skipped: true, reason: 'missing_config' }
  }

  const resetUrl = `${appUrl}/auth?view=reset-password&token=${encodeURIComponent(token)}`
  const { subject, html, text } = buildPasswordResetEmail({ resetUrl })
  const transporter = getTransporter()
  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text,
  })

  return { sent: true, messageId: info?.messageId }
}
