type LogContextLike = unknown

const isProduction = process.env.NODE_ENV === 'production'

function formatContext(context?: LogContextLike): string {
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

export const logger = {
  info(message: string, context?: LogContextLike) {
    if (isProduction) return
    console.log(`[info] ${message}${formatContext(context)}`)
  },
  warn(message: string, context?: LogContextLike) {
    console.warn(`[warn] ${message}${formatContext(context)}`)
  },
  error(message: string, context?: LogContextLike) {
    console.error(`[error] ${message}${formatContext(context)}`)
  },
}
