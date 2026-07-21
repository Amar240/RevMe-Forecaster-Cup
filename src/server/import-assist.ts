import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import type { z } from 'zod'
import { logger } from '@/lib/logger'

export const IMPORT_ASSIST_MODEL = process.env.BEDROCK_IMPORT_MODEL || 'anthropic.claude-3-haiku-20240307-v1:0'
export function isImportAssistEnabled() { return process.env.BEDROCK_IMPORT_ASSIST === 'true' }

let client: BedrockRuntimeClient | null = null
function bedrock() { return client ??= new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-2', maxAttempts: 1 }) }

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const source = fenced ?? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  if (!source) throw new Error('Model response did not contain JSON')
  return JSON.parse(source) as unknown
}

export async function invokeImportAssist<T>(args: { system: string; input: unknown; schema: z.ZodType<T> }): Promise<T | null> {
  if (!isImportAssistEnabled()) return null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await bedrock().send(new InvokeModelCommand({
        modelId: IMPORT_ASSIST_MODEL,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({ anthropic_version: 'bedrock-2023-05-31', max_tokens: 2048, temperature: 0, system: args.system, messages: [{ role: 'user', content: JSON.stringify(args.input) }] }),
      }), { abortSignal: controller.signal })
      const envelope = JSON.parse(new TextDecoder().decode(response.body)) as { content?: Array<{ type?: string; text?: string }> }
      const text = envelope.content?.find((item) => item.type === 'text')?.text
      const parsed = args.schema.safeParse(extractJson(text ?? ''))
      if (!parsed.success) throw new Error('Model response failed schema validation')
      return parsed.data
    } catch (error) {
      if (attempt === 1) logger.warn('Bedrock import assist unavailable', { model: IMPORT_ASSIST_MODEL, error: error instanceof Error ? error.message : 'unknown error' })
    } finally { clearTimeout(timeout) }
  }
  return null
}

export function resetImportAssistClientForTests() { client?.destroy(); client = null }
