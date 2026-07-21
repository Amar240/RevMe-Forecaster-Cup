import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { logger } from '@/lib/logger'

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, '') || 'roster.xlsx'
}

export async function archiveImportFile(args: { seasonId: string; batchId: string; fileName: string; fileBuffer: Buffer }) {
  const bucket = process.env.ARCHIVE_S3_BUCKET
  if (!bucket || !process.env.AWS_REGION) {
    logger.warn('Roster import archival skipped because S3 is not configured', { batchId: args.batchId })
    return null
  }
  const key = `imports/${args.seasonId}/${args.batchId}/${safeFileName(args.fileName)}`
  try {
    await new S3Client({ region: process.env.AWS_REGION }).send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: args.fileBuffer,
      ContentType: args.fileName.toLowerCase().endsWith('.csv') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ServerSideEncryption: 'AES256',
    }))
    return key
  } catch (error) {
    logger.warn('Roster import archival failed; continuing without S3', { batchId: args.batchId, error })
    return null
  }
}
