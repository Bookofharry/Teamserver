import nodemailer from 'nodemailer'
import logger from './logger.js'

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
let didVerify = false

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

const verifyTransporter = async () => {
  if (didVerify || process.env.NODE_ENV === 'production') return
  didVerify = true
  try {
    const transporter = getTransporter()
    await transporter.verify()
    logger.info('SMTP connection verified')
  } catch (error) {
    logger.warn({ error: error?.message || error }, 'SMTP connection failed')
  }
}

const logSkippedEmail = (reason, details = {}) => {
  const payload = { reason, ...details }
  logger.warn(payload, 'Email skipped')
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[email] skipped', payload)
  }
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

const buildSignupOtpEmail = ({ code }) => {
  const safeCode = escapeHtml(code)
  const subject = 'Your TeamPad verification code'
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2 style="margin: 0 0 12px;">Verify your email</h2>
      <p style="margin: 0 0 12px;">Use this code to finish creating your TeamPad account:</p>
      <p style="margin: 0 0 16px; font-size: 22px; font-weight: 700; letter-spacing: 2px;">
        ${safeCode}
      </p>
      <p style="margin: 0; font-size: 12px; color: #555;">
        This code expires in 10 minutes.
      </p>
    </div>
  `
  const text = `Your TeamPad verification code: ${code}\nThis code expires in 10 minutes.`
  return { subject, html, text }
}

const buildTwoFactorEmail = ({ code }) => {
  const safeCode = escapeHtml(code)
  const subject = 'Your TeamPad sign-in code'
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2 style="margin: 0 0 12px;">Confirm your sign-in</h2>
      <p style="margin: 0 0 12px;">Use this code to complete your TeamPad sign-in:</p>
      <p style="margin: 0 0 16px; font-size: 22px; font-weight: 700; letter-spacing: 2px;">
        ${safeCode}
      </p>
      <p style="margin: 0; font-size: 12px; color: #555;">
        This code expires in 10 minutes.
      </p>
    </div>
  `
  const text = `Your TeamPad sign-in code: ${code}\nThis code expires in 10 minutes.`
  return { subject, html, text }
}

const buildMentionEmail = ({ workspaceName, senderName, snippet, appUrl }) => {
  const safeWorkspace = escapeHtml(workspaceName || 'TeamPad workspace')
  const safeSender = escapeHtml(senderName || 'Someone')
  const safeSnippet = escapeHtml(snippet || '')
  const subject = `You were mentioned in ${safeWorkspace}`
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2 style="margin: 0 0 12px;">You were mentioned on TeamPad</h2>
      <p style="margin: 0 0 12px;">
        ${safeSender} mentioned you in <strong>${safeWorkspace}</strong>.
      </p>
      ${safeSnippet ? `<p style="margin: 0 0 12px; color: #334155;">"${safeSnippet}"</p>` : ''}
      <p style="margin: 0 0 16px;">
        <a href="${escapeHtml(appUrl)}" style="color: #0f172a; font-weight: 600; text-decoration: none;">
          Open TeamPad
        </a>
      </p>
      <p style="margin: 0; font-size: 12px; color: #555;">
        You can manage notifications in your workspace settings.
      </p>
    </div>
  `
  const text = [
    `${senderName || 'Someone'} mentioned you in ${workspaceName || 'TeamPad workspace'}.`,
    snippet ? `"${snippet}"` : '',
    `Open TeamPad: ${appUrl}`,
  ]
    .filter(Boolean)
    .join('\n')
  return { subject, html, text }
}

export const sendWorkspaceInviteEmail = async ({ to, workspaceName, inviterName, role, token }) => {
  const host = (process.env.SMTP_HOST || '').trim()
  const from = (process.env.SMTP_FROM || '').trim()
  const appUrl = getAppUrl()
  if (!host || !from || !appUrl) {
    logSkippedEmail('missing_config', { to, needsAppUrl: !appUrl })
    return { sent: false, skipped: true, reason: 'missing_config' }
  }

  await verifyTransporter()
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
    logSkippedEmail('missing_config', { to, needsAppUrl: !appUrl })
    return { sent: false, skipped: true, reason: 'missing_config' }
  }

  await verifyTransporter()
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

export const sendSignupOtpEmail = async ({ to, code }) => {
  const host = (process.env.SMTP_HOST || '').trim()
  const from = (process.env.SMTP_FROM || '').trim()
  if (!host || !from) {
    logSkippedEmail('missing_config', { to })
    return { sent: false, skipped: true, reason: 'missing_config' }
  }

  await verifyTransporter()
  const { subject, html, text } = buildSignupOtpEmail({ code })
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

export const sendTwoFactorCodeEmail = async ({ to, code }) => {
  const host = (process.env.SMTP_HOST || '').trim()
  const from = (process.env.SMTP_FROM || '').trim()
  if (!host || !from) {
    logSkippedEmail('missing_config', { to })
    return { sent: false, skipped: true, reason: 'missing_config' }
  }

  await verifyTransporter()
  const { subject, html, text } = buildTwoFactorEmail({ code })
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

export const sendMentionEmail = async ({ to, workspaceName, senderName, snippet }) => {
  const host = (process.env.SMTP_HOST || '').trim()
  const from = (process.env.SMTP_FROM || '').trim()
  const appUrl = getAppUrl()
  if (!host || !from || !appUrl) {
    logSkippedEmail('missing_config', { to, needsAppUrl: !appUrl })
    return { sent: false, skipped: true, reason: 'missing_config' }
  }

  await verifyTransporter()
  const { subject, html, text } = buildMentionEmail({ workspaceName, senderName, snippet, appUrl })
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
