const LOCAL_BASE_URL = 'http://localhost:5000'

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return LOCAL_BASE_URL
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    return new URL(withProtocol).origin
  } catch {
    return LOCAL_BASE_URL
  }
}

export function getAppBaseUrl() {
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL || LOCAL_BASE_URL)
}
