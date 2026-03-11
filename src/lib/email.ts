import nodemailer from 'nodemailer'
import { logger } from './logger'
import { getAppBaseUrl } from './app-url'

const getTransporter = () => {
  if (process.env.NODE_ENV === 'test') {
    return null
  }
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = parseInt(process.env.SMTP_PORT || '587')
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS

  if (!smtpHost || !smtpUser || !smtpPass) {
    logger.warn('SMTP not configured. Email sending disabled.')
    return null
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })
}

const getFromEmail = () => {
  return process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@rev-me.org'
}

const emailHeader = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">
  <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">RevME Forecaster Cup</h1>
    </div>
    <div style="padding: 32px;">
`

const emailFooter = `
    </div>
    <div style="background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
      <p style="margin: 0;">RevME Forecaster Cup - Hospitality Revenue Forecasting Competition</p>
      <p style="margin: 8px 0 0 0;">This is an automated message. Please do not reply.</p>
    </div>
  </div>
</body>
</html>
`

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
): Promise<boolean> {
  const transporter = getTransporter()
  const resetUrl = `${getAppBaseUrl()}/reset-password?token=${resetToken}`

  if (!transporter) {
    logger.info('Password reset requested but SMTP not configured', { email, resetUrl })
    return false
  }

  try {
    await transporter.sendMail({
      from: `"RevME Forecaster Cup" <${getFromEmail()}>`,
      to: email,
      subject: 'Reset Your Password - RevME Forecaster Cup',
      text: `
Hello,

You requested to reset your password for RevME Forecaster Cup.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you did not request this, please ignore this email.

Best regards,
The RevME Team
      `,
      html: `${emailHeader}
        <h2 style="margin-top: 0; color: #1e293b;">Reset Your Password</h2>
        <p>You requested to reset your password. Click the button below to set a new password:</p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">
            Reset Password
          </a>
        </div>
        
        <p style="color: #64748b; font-size: 14px;">This link will expire in 1 hour.</p>
        <p style="color: #64748b; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
      ${emailFooter}`,
    })

    logger.info('Password reset email sent', { email })
    return true
  } catch (error) {
    logger.error('Failed to send password reset email', {
      email,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export async function sendRoundOpenEmail(
  email: string,
  roundNumber: number,
  deadline: Date,
  teamName: string
): Promise<boolean> {
  const transporter = getTransporter()
  const submitUrl = `${getAppBaseUrl()}/submit`

  if (!transporter) {
    logger.info('Round open reminder skipped (SMTP not configured)', {
      email,
      roundNumber,
      teamName,
    })
    return false
  }

  const deadlineStr = deadline.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }) + ' ET'

  try {
    await transporter.sendMail({
      from: `"RevME Forecaster Cup" <${getFromEmail()}>`,
      to: email,
      subject: `Round ${roundNumber} is Now Open - RevME Forecaster Cup`,
      text: `
Hello,

Round ${roundNumber} is now open for submissions!

Team: ${teamName}
Deadline: ${deadlineStr}

Submit your forecasts for all 3 markets (Nashville CBD, Dubai, Hamburg) before the deadline.

Submit now: ${submitUrl}

Good luck!
The RevME Team
      `,
      html: `${emailHeader}
        <h2 style="margin-top: 0; color: #1e293b;">Round ${roundNumber} is Open!</h2>
        
        <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Team:</strong> ${teamName}</p>
          <p style="margin: 0;"><strong>Deadline:</strong> ${deadlineStr}</p>
        </div>
        
        <p>Submit your forecasts for all 3 markets before the deadline:</p>
        <ul style="color: #475569;">
          <li>Nashville CBD</li>
          <li>Dubai</li>
          <li>Hamburg</li>
        </ul>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${submitUrl}" style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">
            Submit Forecast
          </a>
        </div>
        
        <p style="color: #64748b; font-size: 14px;">Remember: Once submitted, your forecast is locked and cannot be edited.</p>
      ${emailFooter}`,
    })

    logger.info('Round open email sent', { email, roundNumber, teamName })
    return true
  } catch (error) {
    logger.error('Failed to send round open email', {
      email,
      roundNumber,
      teamName,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export async function sendSubmissionReceiptEmail(params: {
  email: string
  teamName: string
  roundNumber: number
  submittedAt: Date
  submittedByName: string
  recipientRole: 'STUDENT' | 'SUPERVISOR'
}): Promise<boolean> {
  if (process.env.NODE_ENV === 'test') {
    return false
  }
  const transporter = getTransporter()
  const submitUrl = `${getAppBaseUrl()}/submit`

  if (!transporter) {
    logger.info('Submission receipt skipped (SMTP not configured)', {
      email: params.email,
      teamName: params.teamName,
      roundNumber: params.roundNumber,
    })
    return false
  }

  const submittedAtStr =
    params.submittedAt.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }) + ' ET'

  const introText =
    params.recipientRole === 'SUPERVISOR'
      ? `A submission was locked for your team "${params.teamName}" by ${params.submittedByName}.`
      : `Your submission for "${params.teamName}" has been locked.`

  try {
    await transporter.sendMail({
      from: `"RevME Forecaster Cup" <${getFromEmail()}>`,
      to: params.email,
      subject: `Submission Received - Round ${params.roundNumber}`,
      text: `
Hello,

${introText}

Round: ${params.roundNumber}
Team: ${params.teamName}
Submitted: ${submittedAtStr}

View submission: ${submitUrl}

Reminder: submissions are locked immediately after submit and cannot be edited.

The RevME Team
      `,
      html: `${emailHeader}
        <h2 style="margin-top: 0; color: #1e293b;">Submission Received</h2>
        <p>${introText}</p>

        <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Round:</strong> ${params.roundNumber}</p>
          <p style="margin: 0 0 8px 0;"><strong>Team:</strong> ${params.teamName}</p>
          <p style="margin: 0;"><strong>Submitted:</strong> ${submittedAtStr}</p>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${submitUrl}" style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">
            View Submission
          </a>
        </div>

        <p style="color: #64748b; font-size: 14px;">Submissions are locked immediately after submit and cannot be edited.</p>
      ${emailFooter}`,
    })

    logger.info('Submission receipt email sent', {
      email: params.email,
      teamName: params.teamName,
      roundNumber: params.roundNumber,
      recipientRole: params.recipientRole,
    })
    return true
  } catch (error) {
    logger.error('Failed to send submission receipt email', {
      email: params.email,
      teamName: params.teamName,
      roundNumber: params.roundNumber,
      recipientRole: params.recipientRole,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export async function sendMissedSubmissionWarning(
  email: string,
  teamName: string,
  roundNumber: number,
  warningCount: number
): Promise<boolean> {
  const transporter = getTransporter()
  const dashboardUrl = `${getAppBaseUrl()}/dashboard`

  if (!transporter) {
    logger.info('Missed submission warning skipped (SMTP not configured)', {
      email,
      teamName,
      roundNumber,
      warningCount,
    })
    return false
  }

  const isDisqualified = warningCount >= 3
  const subject = isDisqualified 
    ? `Team Disqualified - RevME Forecaster Cup`
    : `Warning ${warningCount}/3: Missed Submission - RevME Forecaster Cup`

  const warningColor = warningCount === 1 ? '#f59e0b' : warningCount === 2 ? '#ef4444' : '#991b1b'

  try {
    await transporter.sendMail({
      from: `"RevME Forecaster Cup" <${getFromEmail()}>`,
      to: email,
      subject,
      text: isDisqualified
        ? `
Hello,

Unfortunately, team "${teamName}" has been disqualified from the RevME Forecaster Cup.

Reason: 3 missed submissions

Round ${roundNumber} was the third missed submission, which results in automatic disqualification per competition rules.

We hope to see you compete in future seasons!

The RevME Team
        `
        : `
Hello,

This is a warning that team "${teamName}" missed the submission deadline for Round ${roundNumber}.

Warning Count: ${warningCount}/3

${warningCount === 1 ? 'This is your first warning. Please make sure to submit on time for future rounds.' : ''}
${warningCount === 2 ? 'This is your SECOND warning. One more missed submission will result in disqualification!' : ''}

View your dashboard: ${dashboardUrl}

The RevME Team
        `,
      html: `${emailHeader}
        ${isDisqualified ? `
          <div style="background: #fef2f2; border-left: 4px solid #991b1b; padding: 16px; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #991b1b;">Team Disqualified</h2>
          </div>
          <p>Unfortunately, team <strong>"${teamName}"</strong> has been disqualified from the RevME Forecaster Cup.</p>
          <p><strong>Reason:</strong> 3 missed submissions</p>
          <p>Round ${roundNumber} was the third missed submission, which results in automatic disqualification per competition rules.</p>
          <p style="color: #64748b;">We hope to see you compete in future seasons!</p>
        ` : `
          <div style="background: ${warningCount === 2 ? '#fef2f2' : '#fffbeb'}; border-left: 4px solid ${warningColor}; padding: 16px; margin-bottom: 20px;">
            <h2 style="margin: 0; color: ${warningColor};">Warning ${warningCount}/3</h2>
          </div>
          
          <p>Team <strong>"${teamName}"</strong> missed the submission deadline for <strong>Round ${roundNumber}</strong>.</p>
          
          <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: ${warningColor};">${warningCount} / 3 Warnings</p>
            <p style="margin: 8px 0 0 0; color: #64748b; font-size: 14px;">
              ${warningCount === 1 ? 'First warning - please submit on time for future rounds' : 'One more missed submission will result in disqualification!'}
            </p>
          </div>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">
              View Dashboard
            </a>
          </div>
        `}
      ${emailFooter}`,
    })

    logger.info('Missed submission warning email sent', {
      email,
      teamName,
      roundNumber,
      warningCount,
    })
    return true
  } catch (error) {
    logger.error('Failed to send warning email', {
      email,
      teamName,
      roundNumber,
      warningCount,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export async function sendWelcomeEmail(
  email: string,
  firstName: string,
  role: 'STUDENT' | 'SUPERVISOR'
): Promise<boolean> {
  const transporter = getTransporter()
  const loginUrl = `${getAppBaseUrl()}/login`

  if (!transporter) {
    logger.info('Welcome email skipped (SMTP not configured)', {
      email,
      firstName,
      role,
    })
    return false
  }

  const isStudent = role === 'STUDENT'

  try {
    await transporter.sendMail({
      from: `"RevME Forecaster Cup" <${getFromEmail()}>`,
      to: email,
      subject: `Welcome to RevME Forecaster Cup!`,
      text: `
Hello ${firstName},

Welcome to the RevME Forecaster Cup!

${isStudent 
  ? `You've registered as a student. To participate in the competition, you'll need to be added to a team by a supervisor.

Once you're on a team, you can:
- View competition rounds and deadlines
- Submit forecasts (if designated as team submitter)
- Track your team's scores and rankings
- Compete on the leaderboards`
  : `You've registered as a supervisor. You can now:
- Create and manage up to 10 teams
- Add students to your teams (up to 5 per team)
- Designate submitters for each team
- Monitor your teams' performance`}

Login: ${loginUrl}

Good luck!
The RevME Team
      `,
      html: `${emailHeader}
        <h2 style="margin-top: 0; color: #1e293b;">Welcome, ${firstName}!</h2>
        <p>You've successfully registered for the RevME Forecaster Cup as a <strong>${isStudent ? 'Student' : 'Supervisor'}</strong>.</p>
        
        ${isStudent ? `
          <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 12px 0; font-weight: 600; color: #0369a1;">Next Step: Get Added to a Team</p>
            <p style="margin: 0; color: #475569;">A supervisor needs to add you to their team before you can participate. Share your email with your supervisor!</p>
          </div>
          <p>Once you're on a team, you can:</p>
          <ul style="color: #475569;">
            <li>View competition rounds and deadlines</li>
            <li>Submit forecasts (if designated as team submitter)</li>
            <li>Track your team's scores and rankings</li>
            <li>Compete on the leaderboards</li>
          </ul>
        ` : `
          <p>As a supervisor, you can now:</p>
          <ul style="color: #475569;">
            <li>Create and manage up to 10 teams</li>
            <li>Add students to your teams (up to 5 per team)</li>
            <li>Designate submitters for each team</li>
            <li>Monitor your teams' performance</li>
          </ul>
        `}
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${loginUrl}" style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">
            Go to Dashboard
          </a>
        </div>
      ${emailFooter}`,
    })

    logger.info('Welcome email sent', { email, firstName, role })
    return true
  } catch (error) {
    logger.error('Failed to send welcome email', {
      email,
      firstName,
      role,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
}): Promise<boolean> {
  const transporter = getTransporter()
  if (!transporter) {
    logger.info('Email skipped (SMTP not configured)', { to: params.to, subject: params.subject })
    return false
  }
  try {
    await transporter.sendMail({
      from: `"RevME Forecaster Cup" <${getFromEmail()}>`,
      to: params.to,
      subject: params.subject,
      html: `${emailHeader}${params.html}${emailFooter}`,
    })
    logger.info('Email sent', { to: params.to, subject: params.subject })
    return true
  } catch (error) {
    logger.error('Failed to send email', {
      to: params.to,
      subject: params.subject,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export async function sendDemoRequestEmail(params: {
  name: string
  email: string
  organization?: string | null
  message?: string | null
}): Promise<boolean> {
  const transporter = getTransporter()
  const notifyEmail = process.env.DEMO_REQUEST_NOTIFY_EMAIL || getFromEmail()

  if (!transporter) {
    logger.info('Demo request email skipped (SMTP not configured)', {
      email: params.email,
      organization: params.organization,
    })
    return false
  }

  try {
    await transporter.sendMail({
      from: `"RevME Forecaster Cup" <${getFromEmail()}>`,
      to: notifyEmail,
      subject: `New Demo Request - ${params.organization ?? 'Organization'}`,
      text: `
New demo request received.

Name: ${params.name}
Email: ${params.email}
Organization: ${params.organization ?? 'N/A'}
Message: ${params.message ?? 'N/A'}
      `,
      html: `${emailHeader}
        <h2 style="margin-top: 0; color: #1e293b;">New Demo Request</h2>
        <p><strong>Name:</strong> ${params.name}</p>
        <p><strong>Email:</strong> ${params.email}</p>
        <p><strong>Organization:</strong> ${params.organization ?? 'N/A'}</p>
        <p><strong>Message:</strong> ${params.message ?? 'N/A'}</p>
      ${emailFooter}`,
    })

    logger.info('Demo request email sent', { email: params.email })
    return true
  } catch (error) {
    logger.error('Failed to send demo request email', {
      email: params.email,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}
