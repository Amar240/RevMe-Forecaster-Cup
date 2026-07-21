import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const send = vi.fn()
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: class { send = send; destroy() {} },
  InvokeModelCommand: class { constructor(public input: unknown) {} },
}))

describe('Bedrock import assist boundary', () => {
  beforeEach(() => { vi.resetModules(); vi.stubEnv('BEDROCK_IMPORT_ASSIST', 'true'); send.mockReset() })

  it('validates JSON output and returns parsed content', async () => {
    send.mockResolvedValue({ body: new TextEncoder().encode(JSON.stringify({ content: [{ type: 'text', text: '```json\n{"value":"safe"}\n```' }] })) })
    const { invokeImportAssist } = await import('@/server/import-assist')
    await expect(invokeImportAssist({ system: 'test', input: { rows: [] }, schema: z.object({ value: z.literal('safe') }) })).resolves.toEqual({ value: 'safe' })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('discards malformed output after one retry', async () => {
    send.mockResolvedValue({ body: new TextEncoder().encode(JSON.stringify({ content: [{ type: 'text', text: '{"wrong":true}' }] })) })
    const { invokeImportAssist } = await import('@/server/import-assist')
    await expect(invokeImportAssist({ system: 'test', input: {}, schema: z.object({ value: z.string() }) })).resolves.toBeNull()
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('does not invoke Bedrock while the flag is off', async () => {
    vi.stubEnv('BEDROCK_IMPORT_ASSIST', 'false')
    const { invokeImportAssist } = await import('@/server/import-assist')
    await expect(invokeImportAssist({ system: 'test', input: {}, schema: z.object({ value: z.string() }) })).resolves.toBeNull()
    expect(send).not.toHaveBeenCalled()
  })
})
