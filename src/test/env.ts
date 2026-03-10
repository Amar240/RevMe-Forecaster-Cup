import * as dotenv from 'dotenv'
import { existsSync } from 'node:fs'

dotenv.config({ path: '.env.test' })

// Allow each machine to override test DB credentials without committing secrets.
if (existsSync('.env.test.local')) {
  dotenv.config({ path: '.env.test.local', override: true })
}
