import { NextRequest } from 'next/server'

export function makeRequest(
  url: string,
  options: {
    method?: string
    body?: unknown
    headers?: HeadersInit
    cookies?: string
  } = {}
) {
  const headers = new Headers(options.headers ?? {})

  if (options.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  if (options.cookies) {
    headers.set('cookie', options.cookies)
  }

  const init: Record<string, unknown> = {
    method: options.method || 'GET',
    headers,
  }

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body)
  }

  return new NextRequest(url, init as any)
}
