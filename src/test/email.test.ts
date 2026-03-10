import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('nodemailer', () => {
  const sendMailMock = vi.fn().mockResolvedValue({ messageId: 'test-id' })
  return {
    default: {
      createTransport: vi.fn().mockReturnValue({ sendMail: sendMailMock }),
    },
    __sendMailMock: sendMailMock,
  }
})

describe('Email functions', () => {
  let sendPasswordResetEmail: typeof import('@/lib/email').sendPasswordResetEmail
  let sendWelcomeEmail: typeof import('@/lib/email').sendWelcomeEmail
  let sendMailMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('SMTP_HOST', 'smtp.test.com')
    vi.stubEnv('SMTP_USER', 'user@test.com')
    vi.stubEnv('SMTP_PASS', 'pass123')
    vi.stubEnv('SMTP_PORT', '587')

    const emailModule = await import('@/lib/email')
    sendPasswordResetEmail = emailModule.sendPasswordResetEmail
    sendWelcomeEmail = emailModule.sendWelcomeEmail

    const nodemailerMock = await import('nodemailer')
    sendMailMock = (nodemailerMock as unknown as { __sendMailMock: ReturnType<typeof vi.fn> }).__sendMailMock
    sendMailMock.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sendPasswordResetEmail calls transporter.sendMail with correct args', async () => {
    const result = await sendPasswordResetEmail('test@example.com', 'reset-token-123')

    expect(result).toBe(true)
    expect(sendMailMock).toHaveBeenCalledTimes(1)

    const call = sendMailMock.mock.calls[0][0]
    expect(call.to).toBe('test@example.com')
    expect(call.subject).toContain('Reset Your Password')
    expect(call.html).toContain('reset-token-123')
  })

  it('sendWelcomeEmail calls transporter.sendMail', async () => {
    const result = await sendWelcomeEmail('student@example.com', 'Alice', 'STUDENT')

    expect(result).toBe(true)
    expect(sendMailMock).toHaveBeenCalledTimes(1)

    const call = sendMailMock.mock.calls[0][0]
    expect(call.to).toBe('student@example.com')
    expect(call.subject).toContain('Welcome')
    expect(call.html).toContain('Alice')
  })

  it('email functions return false when SMTP not configured', async () => {
    vi.stubEnv('SMTP_HOST', '')
    vi.stubEnv('SMTP_USER', '')
    vi.stubEnv('SMTP_PASS', '')

    const freshModule = await import('@/lib/email')
    const result = await freshModule.sendPasswordResetEmail('test@example.com', 'token')

    expect(result).toBe(false)
  })
})
