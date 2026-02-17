type ClientLogContextLike = unknown

const isDev = process.env.NODE_ENV !== 'production'

function formatContext(context?: ClientLogContextLike): string {
  if (context === undefined || context === null) return ''
  if (context instanceof Error) {
    return ` ${JSON.stringify({ error: context.message })}`
  }
  if (typeof context !== 'object') {
    return ` ${JSON.stringify({ detail: context })}`
  }
  if (Object.keys(context).length === 0) return ''
  try {
    return ` ${JSON.stringify(context)}`
  } catch {
    return ' [context-unserializable]'
  }
}

export const clientLogger = {
  info(message: string, context?: ClientLogContextLike) {
    if (!isDev) return
    // eslint-disable-next-line no-console
    console.log(`[info] ${message}${formatContext(context)}`)
  },
  warn(message: string, context?: ClientLogContextLike) {
    if (!isDev) return
    // eslint-disable-next-line no-console
    console.warn(`[warn] ${message}${formatContext(context)}`)
  },
  error(message: string, context?: ClientLogContextLike) {
    if (!isDev) return
    // eslint-disable-next-line no-console
    console.error(`[error] ${message}${formatContext(context)}`)
  },
}
