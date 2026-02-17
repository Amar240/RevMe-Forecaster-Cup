import crypto from 'crypto'
import { prisma } from './db'

export async function loginAs(userId: string) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  })

  global.__testAuthToken = token
  return token
}

export function logout() {
  global.__testAuthToken = null
}
