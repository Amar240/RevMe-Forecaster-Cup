const CSRF_COOKIE = 'revme_csrf'

const isUnsafeMethod = (method: string) =>
  method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'

export const getCsrfToken = (): string | null => {
  if (typeof document === 'undefined') return null
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${CSRF_COOKIE}=`))
  if (!cookie) return null
  return decodeURIComponent(cookie.split('=')[1])
}

export const csrfFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers ?? {})

  if (isUnsafeMethod(method)) {
    const token = getCsrfToken()
    if (token) {
      headers.set('x-csrf-token', token)
    }
  }

  return fetch(input, { ...init, headers })
}
