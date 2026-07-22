import { jsonError, jsonOk, requireUserOrResponse } from '@/server/http'
import { disconnectGoogleAccount } from '@/server/oauth'
export async function DELETE() { try { const { user, response } = await requireUserOrResponse(); if (response) return response; await disconnectGoogleAccount(user!.id); return jsonOk({ message: 'Google disconnected' }) } catch (error) { return jsonError(error, 'Failed to disconnect Google') } }
