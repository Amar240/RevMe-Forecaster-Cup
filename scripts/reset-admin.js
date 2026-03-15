const fs = require('fs')
const path = require('path')

function loadEnv(file, override = false) {
  const envPath = path.join(__dirname, '..', file)
  if (!fs.existsSync(envPath)) return
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) return
    const key = m[1].trim()
    if (override || !process.env[key]) {
      process.env[key] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  })
}
try {
  loadEnv('.env')
  loadEnv('.env.local', true) // .env.local overrides so app and script use same DB
} catch (_) {}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to .env or .env.local, or run: $env:DATABASE_URL="postgresql://..."; npm run db:reset-admin')
  process.exit(1)
}
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

async function main() {
  const prisma = new PrismaClient()
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.')
  }

  const passwordHash = await bcrypt.hash(password, 12)

  // Update or create the target admin
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { passwordHash, role: 'ADMIN', emailVerified: true },
    })
    console.log(`Updated admin: ${email}`)
  } else {
    const universityName = process.env.ADMIN_UNIVERSITY_NAME || 'University of Delaware'
    let university = await prisma.university.findFirst({ where: { name: universityName } })
    if (!university) {
      university = await prisma.university.create({ data: { name: universityName } })
    }
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        emailVerified: true,
        universityId: university.id,
      },
    })
    console.log(`Created admin: ${email}`)
  }

  // Update or remove the other admin (Admin@revme.org) if it differs from target
  const otherEmail = email.toLowerCase() === 'admin@revme.org' ? 'Admin@revme.org' : 'admin@revme.org'
  const other = await prisma.user.findUnique({ where: { email: otherEmail } })
  if (other) {
    try {
      await prisma.user.delete({ where: { email: otherEmail } })
      console.log(`Removed duplicate admin: ${otherEmail}`)
    } catch (err) {
      await prisma.user.update({
        where: { email: otherEmail },
        data: { passwordHash, role: 'ADMIN', emailVerified: true },
      })
      console.log(`Updated duplicate admin: ${otherEmail} (delete skipped due to references)`)
    }
  }

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
