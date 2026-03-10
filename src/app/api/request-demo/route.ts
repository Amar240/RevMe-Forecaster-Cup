import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/server/db'
import { jsonError, jsonOk, parseJson } from '@/server/http'
import { logger } from '@/server/logger'
import { sendDemoRequestEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  organization: z.string().optional(),
  message: z.string().optional(),
  companyWebsite: z.string().optional(), // honeypot field
})

export async function POST(request: NextRequest) {
  try {
    const body = await parseJson(request, requestSchema)

    if (body.companyWebsite) {
      return jsonOk({ ok: true })
    }

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    const userAgent = request.headers.get('user-agent') || null

    const demoRequest = await prisma.demoRequest.create({
      data: {
        name: body.name,
        email: body.email,
        organization: body.organization || null,
        message: body.message || null,
        ipAddress,
        userAgent,
        source: 'landing',
      },
    })

    await sendDemoRequestEmail({
      name: demoRequest.name,
      email: demoRequest.email,
      organization: demoRequest.organization,
      message: demoRequest.message,
    })

    return jsonOk({ ok: true })
  } catch (error) {
    logger.error('Demo request failed', error)
    return jsonError(error, 'Unable to submit demo request')
  }
}
