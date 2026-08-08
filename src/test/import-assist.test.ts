import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const send = vi.fn()
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: class { send = send; destroy() {} },
  ConverseCommand: class { constructor(public input: unknown) {} },
}))

const outputSchema = { type: 'object', additionalProperties: false, required: ['value'], properties: { value: { type: 'string' } } }

describe('Bedrock import assist boundary', () => {
  beforeEach(() => { vi.resetModules(); vi.stubEnv('BEDROCK_IMPORT_ASSIST', 'true'); send.mockReset() })

  it('validates JSON output and returns parsed content', async () => {
    send.mockResolvedValue({ output: { message: { content: [{ text: '{"value":"safe"}' }] } }, usage: { inputTokens: 3, outputTokens: 2 } })
    const { invokeImportAssist } = await import('@/server/import-assist')
    await expect(invokeImportAssist({ system: 'test', input: { rows: [] }, schema: z.object({ value: z.literal('safe') }), jsonSchema: outputSchema, schemaName: 'test_output' })).resolves.toMatchObject({ data: { value: 'safe' }, inputTokens: 3, outputTokens: 2 })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed structured output without retrying', async () => {
    send.mockResolvedValue({ output: { message: { content: [{ text: '{"wrong":true}' }] } } })
    const { invokeImportAssist } = await import('@/server/import-assist')
    await expect(invokeImportAssist({ system: 'test', input: {}, schema: z.object({ value: z.string() }), jsonSchema: outputSchema, schemaName: 'test_output' })).resolves.toMatchObject({ unavailableCategory: 'SCHEMA_REJECTED', retryable: false })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('does not invoke Bedrock while the flag is off', async () => {
    vi.stubEnv('BEDROCK_IMPORT_ASSIST', 'false')
    const { invokeImportAssist } = await import('@/server/import-assist')
    await expect(invokeImportAssist({ system: 'test', input: {}, schema: z.object({ value: z.string() }), jsonSchema: outputSchema, schemaName: 'test_output' })).resolves.toMatchObject({ unavailableCategory: 'MODEL_UNAVAILABLE', retryable: false })
    expect(send).not.toHaveBeenCalled()
  })

  it.each([
    ['CredentialsProviderError', 'Could not load credentials from any providers', 'CREDENTIALS_MISSING', 1],
    ['AccessDeniedException', 'User is not authorized to perform bedrock:InvokeModel', 'ACCESS_DENIED', 1],
    ['ValidationException', 'The requested inference profile is not available', 'MODEL_UNAVAILABLE', 1],
    ['ThrottlingException', 'Too many requests', 'THROTTLED', 2],
    ['ServiceUnavailableException', 'Service temporarily unavailable', 'SERVICE_UNAVAILABLE', 2],
  ])('classifies %s without exposing infrastructure details', async (name, message, category, calls) => {
    const error = Object.assign(new Error(message), { name })
    send.mockRejectedValue(error)
    const { invokeImportAssist } = await import('@/server/import-assist')
    await expect(invokeImportAssist({ system: 'test', input: {}, schema: z.object({ value: z.string() }), jsonSchema: outputSchema, schemaName: 'test_output' })).resolves.toMatchObject({ unavailableCategory: category })
    expect(send).toHaveBeenCalledTimes(calls)
  })
})
