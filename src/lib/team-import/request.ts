import { ApiError } from '@/server/http'

type FileLike = FormDataEntryValue & {
  name?: string
  size?: number
  arrayBuffer: () => Promise<ArrayBuffer>
}

function isFileLike(value: FormDataEntryValue | null): value is FileLike {
  return Boolean(value && typeof value !== 'string' && typeof value.arrayBuffer === 'function')
}

export async function readTeamImportFormData(request: Request) {
  const formData = await request.formData()
  const seasonIdEntry = formData.get('seasonId')
  const fileEntry = formData.get('file')

  if (typeof seasonIdEntry !== 'string' || !seasonIdEntry.trim()) {
    throw new ApiError('Season is required', 400, 'INVALID_INPUT')
  }

  if (!isFileLike(fileEntry) || !(fileEntry.name ?? '').trim()) {
    throw new ApiError('Import file is required', 400, 'INVALID_INPUT')
  }

  return {
    seasonId: seasonIdEntry.trim(),
    fileName: fileEntry.name!.trim(),
    fileBuffer: Buffer.from(await fileEntry.arrayBuffer()),
  }
}
