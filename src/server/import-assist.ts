import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import type { z } from 'zod'
import { logger } from '@/lib/logger'
import type { ImportAssistUnavailableCategory } from '@/lib/team-import/types'

export type { ImportAssistUnavailableCategory } from '@/lib/team-import/types'

export const IMPORT_ASSIST_MODEL = process.env.BEDROCK_IMPORT_MODEL || 'us.anthropic.claude-haiku-4-5-20251001-v1:0'
export function isImportAssistEnabled() { return process.env.BEDROCK_IMPORT_ASSIST === 'true' }

export type ImportAssistInvocation<T> = { data: T; modelId: string; inputTokens: number; outputTokens: number; latencyMs: number }
export type ImportAssistUnavailable = { unavailableCategory: ImportAssistUnavailableCategory; modelId: string; region: string; latencyMs: number; retryable: boolean }
let client: BedrockRuntimeClient | null = null
function bedrock() { return client ??= new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-2', maxAttempts: 1 }) }

function emitMetric(values: { outcome: 'success' | 'unavailable'; latencyMs: number; inputTokens?: number; outputTokens?: number }) {
  if (process.env.NODE_ENV !== 'production') return
  console.log(JSON.stringify({ _aws: { Timestamp: Date.now(), CloudWatchMetrics: [{ Namespace: 'RevME/ImportAssist', Dimensions: [['ModelId']], Metrics: [{ Name: 'Calls', Unit: 'Count' }, { Name: 'Latency', Unit: 'Milliseconds' }, { Name: 'InputTokens', Unit: 'Count' }, { Name: 'OutputTokens', Unit: 'Count' }, { Name: 'Unavailable', Unit: 'Count' }] }] }, ModelId: IMPORT_ASSIST_MODEL, Calls: 1, Latency: values.latencyMs, InputTokens: values.inputTokens ?? 0, OutputTokens: values.outputTokens ?? 0, Unavailable: values.outcome === 'unavailable' ? 1 : 0 }))
}

export function emitImportAssistOutcomeMetric(outcome: 'ACCEPTED' | 'REJECTED') {
  if (process.env.NODE_ENV !== 'production') return
  console.log(JSON.stringify({ _aws: { Timestamp: Date.now(), CloudWatchMetrics: [{ Namespace: 'RevME/ImportAssist', Dimensions: [], Metrics: [{ Name: 'Accepted', Unit: 'Count' }, { Name: 'Rejected', Unit: 'Count' }] }] }, Accepted: outcome === 'ACCEPTED' ? 1 : 0, Rejected: outcome === 'REJECTED' ? 1 : 0 }))
}

function isRetryable(error: unknown) {
  if (!(error instanceof Error)) return false
  const status = (error as Error & { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
  return Boolean(status && status >= 500) || /throttl|timeout|serviceunavailable|temporar|network/i.test(error.name + error.message)
}

function classifyUnavailable(error: unknown): ImportAssistUnavailableCategory {
  const value = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  const status = error instanceof Error ? (error as Error & { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode : undefined
  if (/CredentialsProviderError|could not load credentials|credential/i.test(value)) return 'CREDENTIALS_MISSING'
  if (status === 401 || status === 403 || /AccessDenied|Unauthorized/i.test(value)) return 'ACCESS_DENIED'
  if (/schema|structured (JSON|output)|outputConfig|textFormat/i.test(value)) return 'SCHEMA_REJECTED'
  if (/Throttl|TooManyRequests/i.test(value) || status === 429) return 'THROTTLED'
  if (/AbortError|Timeout|timed out/i.test(value)) return 'TIMEOUT'
  if (/ValidationException|ResourceNotFound|model.*not.*available|inference profile/i.test(value)) return 'MODEL_UNAVAILABLE'
  return 'SERVICE_UNAVAILABLE'
}

export async function invokeImportAssist<T>(args: { system: string; input: unknown; schema: z.ZodType<T>; jsonSchema: Record<string, unknown>; schemaName: string }): Promise<ImportAssistInvocation<T> | ImportAssistUnavailable> {
  const region = process.env.AWS_REGION || 'us-east-2'
  if (!isImportAssistEnabled()) return { unavailableCategory: 'MODEL_UNAVAILABLE', modelId: IMPORT_ASSIST_MODEL, region, latencyMs: 0, retryable: false }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const startedAt = Date.now()
    try {
      const response = await bedrock().send(new ConverseCommand({
        modelId: IMPORT_ASSIST_MODEL,
        system: [{ text: args.system }],
        messages: [{ role: 'user', content: [{ text: JSON.stringify(args.input) }] }],
        inferenceConfig: { maxTokens: 2048, temperature: 0 },
        outputConfig: { textFormat: { type: 'json_schema', structure: { jsonSchema: { name: args.schemaName, description: 'RevME roster import assistance response', schema: JSON.stringify(args.jsonSchema) } } } },
      }), { abortSignal: controller.signal })
      const text = response.output && 'message' in response.output ? response.output.message?.content?.find((item) => 'text' in item)?.text : undefined
      let decoded: unknown
      try { decoded = JSON.parse(text ?? '') } catch { throw new Error('Model response was not valid structured JSON') }
      const parsed = args.schema.safeParse(decoded)
      if (!parsed.success) throw new Error('Model response failed schema validation')
      const result = { data: parsed.data, modelId: IMPORT_ASSIST_MODEL, inputTokens: response.usage?.inputTokens ?? 0, outputTokens: response.usage?.outputTokens ?? 0, latencyMs: Date.now() - startedAt }
      emitMetric({ outcome: 'success', latencyMs: result.latencyMs, inputTokens: result.inputTokens, outputTokens: result.outputTokens })
      return result
    } catch (error) {
      const category = classifyUnavailable(error)
      const retryable = ['THROTTLED', 'TIMEOUT', 'SERVICE_UNAVAILABLE'].includes(category)
      if (attempt === 0 && retryable) continue
      const latencyMs = Date.now() - startedAt
      logger.warn('Bedrock import assist unavailable', { model: IMPORT_ASSIST_MODEL, region, category, retryable })
      emitMetric({ outcome: 'unavailable', latencyMs })
      return { unavailableCategory: category, modelId: IMPORT_ASSIST_MODEL, region, latencyMs, retryable }
    } finally { clearTimeout(timeout) }
  }
  return { unavailableCategory: 'SERVICE_UNAVAILABLE', modelId: IMPORT_ASSIST_MODEL, region, latencyMs: 0, retryable: true }
}

export function resetImportAssistClientForTests() { client?.destroy(); client = null }
