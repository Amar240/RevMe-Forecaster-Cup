import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const adminEmail = process.env.SEED_ADMIN_EMAIL
  const adminPassword = process.env.SEED_ADMIN_PASSWORD

  if (!adminEmail || !adminPassword) {
    console.log('SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD not set. Skipping admin seed.')
    return
  }

  let admin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!admin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 12)
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
      },
    })
    console.log(`Admin user created: ${adminEmail}`)
  } else {
    console.log('Admin user already exists')
  }

  console.log('\\n=== Admin Credentials ===')
  console.log(`Admin:      ${adminEmail} / [hidden]`)
  console.log('==========================\\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
