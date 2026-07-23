import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { cookies } from 'next/headers'

export const PKCE_COOKIE = 'revme_oauth_pkce'
export const SIGNUP_COOKIE = 'revme_oauth_signup'
export const OAUTH_TTL_MS = 10 * 60 * 1000

function key(purpose: string) { return createHash('sha256').update(`${purpose}:${process.env.GOOGLE_CLIENT_SECRET ?? ''}`).digest() }
export function sealOAuthValue(value: object, purpose: string) { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(purpose), iv); const body = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url') }
export function openOAuthValue<T>(value: string | undefined, purpose: string): T | null { try { if (!value) return null; const data = Buffer.from(value, 'base64url'); const decipher = createDecipheriv('aes-256-gcm', key(purpose), data.subarray(0, 12)); decipher.setAuthTag(data.subarray(12, 28)); return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString()) as T } catch { return null } }
export async function setOAuthCookie(name: string, value: object, purpose: string) { (await cookies()).set(name, sealOAuthValue(value, purpose), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600 }) }
export async function readOAuthCookie<T>(name: string, purpose: string) { return openOAuthValue<T>((await cookies()).get(name)?.value, purpose) }
export async function clearOAuthCookie(name: string) { (await cookies()).delete(name) }
