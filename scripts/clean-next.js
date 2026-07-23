const fs = require('fs')
const path = require('path')

const nextDir = path.join(process.cwd(), '.next')

try {
  fs.rmSync(nextDir, { recursive: true, force: true })
} catch (error) {
  if (error && (error.code === 'ENOENT' || error.code === 'EBUSY')) {
    process.exit(0)
  }

  console.warn('Failed to remove .next before build:', error)
}
