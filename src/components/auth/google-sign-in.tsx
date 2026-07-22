'use client'
import { useEffect, useState } from 'react'
import { csrfFetch } from '@/lib/csrf'
export function GoogleSignIn() {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => { void csrfFetch('/api/auth/google/config').then((response) => response.json()).then((data) => setEnabled(Boolean(data.enabled))).catch(() => {}) }, [])
  if (!enabled) return null
  return <><a href="/api/auth/google/start" className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground shadow-sm hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.6-4.12H3.05v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.94A6 6 0 0 1 6.08 12c0-.67.12-1.33.32-1.94V7.44H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.56l3.35-2.62Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.95 5.44l3.35 2.62C7.2 7.7 9.4 5.94 12 5.94Z"/></svg>Continue with Google</a><div className="flex items-center gap-3"><span className="h-px flex-1 bg-border"/><span className="text-xs text-text-muted">or continue with email</span><span className="h-px flex-1 bg-border"/></div></>
}
