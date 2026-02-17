import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { prisma } from './db'
import bcrypt from 'bcryptjs'
import { User, Role } from '@prisma/client'

const SESSION_COOKIE_NAME = 'revme_session'
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

function generateToken(): string {
  return randomBytes(32).toString('hex')
}

export async function createSession(userId: string): Promise<string> {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_DURATION)
  
  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  })
  
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
  
  return token
}

export async function getSession(): Promise<User | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  
  if (!token) return null
  
  const session = await prisma.session.findUnique({
    where: { token },
  })
  
  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } })
    }
    return null
  }
  
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { university: true },
  })
  
  return user
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  
  if (token) {
    await prisma.session.deleteMany({ where: { token } })
  }
  
  cookieStore.delete(SESSION_COOKIE_NAME)
}

export function requireRole(user: User | null, allowedRoles: Role[]): boolean {
  if (!user) return false
  return allowedRoles.includes(user.role)
}

