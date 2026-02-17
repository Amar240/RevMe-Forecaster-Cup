import { NextRequest } from 'next/server'

export function makeRequest(url: string, options: { method?: string; body?: unknown } = {}) {
  const init: Record<string, unknown> = {
    method: options.method || 'GET',
  }

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body)
    init.headers = { 'content-type': 'application/json' }
  }

  return new NextRequest(url, init as any)
}
