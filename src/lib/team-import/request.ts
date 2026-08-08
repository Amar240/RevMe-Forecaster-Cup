import { ApiError } from '@/server/http'
import { parseTeamImportOverrides } from './overrides'
import { parseColumnMapping } from './assist'
import { parseExcludedRowNumbers } from './exclusions'
import { importErrorDetails } from './diagnostic-catalog'
import { validateTeamImportUpload } from './file-validation'

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
  const batchIdEntry = formData.get('batchId')
  const fileHashEntry = formData.get('fileHash')
  const overridesEntry = formData.get('overrides')
  const columnMappingEntry = formData.get('columnMapping')
  const excludedRowsEntry = formData.get('excludedRowNumbers')
  const universityIdEntry = formData.get('universityId')
  const supervisorIdEntry = formData.get('supervisorId')

  if (typeof seasonIdEntry !== 'string' || !seasonIdEntry.trim()) {
    throw new ApiError('Season is required', 400, 'INVALID_INPUT')
  }

  if (!isFileLike(fileEntry) || !(fileEntry.name ?? '').trim()) {
    throw new ApiError('Import file is required', 400, 'INVALID_INPUT', importErrorDetails('FILE_REQUIRED', 'Import file is required'))
  }
  if ((fileEntry.size ?? 0) > 10 * 1024 * 1024) {
    throw new ApiError('Import file must be 10 MB or smaller', 413, 'INVALID_INPUT', importErrorDetails('FILE_TOO_LARGE', 'Import file must be 10 MB or smaller'))
  }

  const fileName = fileEntry.name!.trim()
  const fileBuffer = Buffer.from(await fileEntry.arrayBuffer())
  validateTeamImportUpload(fileName, fileBuffer)

  return {
    seasonId: seasonIdEntry.trim(),
    fileName,
    fileBuffer,
    batchId: typeof batchIdEntry === 'string' && batchIdEntry.trim() ? batchIdEntry.trim() : null,
    fileHash: typeof fileHashEntry === 'string' && fileHashEntry.trim() ? fileHashEntry.trim() : null,
    overrides: parseTeamImportOverrides(typeof overridesEntry === 'string' ? overridesEntry : null),
    columnMapping: parseColumnMapping(typeof columnMappingEntry === 'string' ? columnMappingEntry : null),
    excludedRowNumbers: parseExcludedRowNumbers(typeof excludedRowsEntry === 'string' ? excludedRowsEntry : null),
    universityId: typeof universityIdEntry === 'string' && universityIdEntry.trim() ? universityIdEntry.trim() : null,
    supervisorId: typeof supervisorIdEntry === 'string' && supervisorIdEntry.trim() ? supervisorIdEntry.trim() : null,
  }
}
