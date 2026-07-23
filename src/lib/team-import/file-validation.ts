import { ApiError } from '@/server/http'
import { importErrorDetails } from './diagnostic-catalog'

const MAX_IMPORT_BYTES = 10 * 1024 * 1024

function fail(message: string, status: number, code: Parameters<typeof importErrorDetails>[0]): never {
  throw new ApiError(message, status, 'INVALID_INPUT', importErrorDetails(code, message))
}

function isProbablyBinary(buffer: Buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192))
  let suspicious = 0
  for (const byte of sample) {
    if (byte === 0) return true
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) suspicious += 1
  }
  return sample.length > 0 && suspicious / sample.length > 0.01
}

export function validateTeamImportUpload(fileName: string, buffer: Buffer) {
  const normalized = fileName.trim().toLowerCase()
  if (fileName.trim().startsWith('~$')) fail('Choose the original workbook, not the temporary Excel lock file whose name begins with ~$.', 422, 'FILE_TEMPORARY')
  if (!buffer.length) fail('The selected roster file is empty. Choose a CSV or Excel workbook containing team rows.', 422, 'FILE_EMPTY')
  if (buffer.length > MAX_IMPORT_BYTES) fail('Import file must be 10 MB or smaller', 413, 'FILE_TOO_LARGE')
  if (!normalized.endsWith('.csv') && !normalized.endsWith('.xlsx')) fail('Only .csv and .xlsx files are supported', 422, 'FILE_UNSUPPORTED')

  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2])
  if (normalized.endsWith('.xlsx') && !isZip) fail('This file is named .xlsx but is not an Excel workbook. Save it again as Excel Workbook (.xlsx).', 422, 'FILE_CONTENT_MISMATCH')
  if (normalized.endsWith('.csv')) {
    if (isZip) fail('This file is named .csv but contains an Excel workbook. Rename or export it using the correct format.', 422, 'FILE_CONTENT_MISMATCH')
    if ((buffer[0] === 0xff && buffer[1] === 0xfe) || (buffer[0] === 0xfe && buffer[1] === 0xff)) fail('This CSV encoding is not supported. Export it as UTF-8 CSV and try again.', 422, 'CSV_ENCODING_UNSUPPORTED')
    if (isProbablyBinary(buffer)) fail('This CSV contains binary data. Export the roster as UTF-8 CSV and try again.', 422, 'CSV_BINARY')
    const decoded = buffer.toString('utf8')
    if (decoded.includes('\ufffd')) fail('This CSV encoding is not supported. Export it as UTF-8 CSV and try again.', 422, 'CSV_ENCODING_UNSUPPORTED')
  }
}
