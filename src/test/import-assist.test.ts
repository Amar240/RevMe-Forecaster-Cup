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

  it('discards malformed output after one retry', async () => {
    send.mockResolvedValue({ output: { message: { content: [{ text: '{"wrong":true}' }] } } })
    const { invokeImportAssist } = await import('@/server/import-assist')
    await expect(invokeImportAssist({ system: 'test', input: {}, schema: z.object({ value: z.string() }), jsonSchema: outputSchema, schemaName: 'test_output' })).resolves.toBeNull()
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('does not invoke Bedrock while the flag is off', async () => {
    vi.stubEnv('BEDROCK_IMPORT_ASSIST', 'false')
    const { invokeImportAssist } = await import('@/server/import-assist')
    await expect(invokeImportAssist({ system: 'test', input: {}, schema: z.object({ value: z.string() }), jsonSchema: outputSchema, schemaName: 'test_output' })).resolves.toBeNull()
    expect(send).not.toHaveBeenCalled()
  })
})
